import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { addTicketTierDto, CreateEventDto, UpdateEventDto } from './dto';
import { PaymentsService } from '../payments/payments.service';
import axios from 'axios';
import { Event } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisClientType } from 'redis';
import { initializeRedis } from '../common/config/redis-conf';
import { Secrets } from '../common/env';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
    @InjectQueue('events-queue') private readonly eventsQueue: Queue,
    private readonly tasks: TasksService
  ) { };

  async createEvent(
    dto: CreateEventDto,
    userId: number,
    poster: string
  ): Promise<Event> {
    try {
      // Verify organizer's account details before creating transfer recipient for revenue splits
      const details = {
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName
      };
      await this.payments.verifyAccountDetails(details);
      const recipientCode = await this.payments.createTransferRecipient(details);

      // Encode event location in URL format and generate coordinates
      const location = `${dto.venue}+${dto.address}`.replace(/(,|-)/g, '').replace(/\s/g, '+');
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${location}&format=json`, {
          headers: {
            'User-Agent': `${Secrets.APP_NAME} ${Secrets.APP_EMAIL}`
          }
        });

      if (response.status === 200 && response.data[0].length > 0) {
        let event: Event;

        // Create organizer profile and store event details
        await this.prisma.$transaction(async (tx) => {
          const organizer = await tx.organizer.create({
            data: {
              name: dto.organizerName,
              email: dto.organizerEmail,
              accountName: dto.accountName,
              accountNumber: dto.accountNumber,
              bankName: dto.bankName,
              recipientCode,
              phone: dto.phone,
              userId,
              instagram: dto.instagram,
              twitter: dto.twitter,
              website: dto.website,
              whatsapp: dto.whatsapp
            }
          });

          event = await tx.event.create({
            data: {
              organizerId: organizer.id,
              title: dto.title,
              category: dto.category,
              description: dto.description,
              date: dto.date,
              startTime: dto.startTime,
              endTime: dto.endTime,
              ageRestriction: +dto.ageRestriction,
              venue: dto.venue,
              address: dto.address,
              capacity: +dto.capacity,
              numberOfShares: 0,
              poster,
              revenue: 0
            }
          });
        });

        // Add coordinates to Redis geolocation store
        const { lat, lon } = response.data[0];
        await this.eventsQueue.add('geolocation-store', {
          longitude: lon as string,
          latitude: lat as string,
          eventId: event.id
        });

        // Set automatic status updates, 1.5 seconds after the start and end of the event
        const ongoingTimeout = Math.max(0, new Date(event.startTime).getTime() - new Date().getTime() + 1500);
        const completedTimeout = Math.max(0, new Date(event.endTime).getTime() - new Date().getTime() + 1500);

        this.tasks.updateOngoingEvents(
          event.id,
          `event_${event.id}_ongoing_update`,
          ongoingTimeout
        );
        this.tasks.updateCompletedEvents(
          event.id,
          `event_${event.id}_completed_update`,
          completedTimeout
        );

        return event;
      } else {
        throw new BadRequestException('Failed to generate coordinates for venue and address');
      };
    } catch (error) {
      throw error;
    }
  }

  async updateEvent(
    dto: UpdateEventDto,
    eventId: number,
    poster?: string
  ): Promise<Event> {
    try {
      const filteredData = Object.entries(dto).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value;
        return acc;
      }, {});

      const updateData: any = {
        ...filteredData,
        ...(dto.capacity !== undefined && { capacity: +dto.capacity }),
        ...(dto.ageRestriction !== undefined && { ageRestriction: +dto.ageRestriction }),
        ...(poster && { poster })
      };
      
      const event = await this.prisma.event.update({
        where: { id: eventId },
        data: { ...updateData },
        include: { users: true }
      });

      if (dto.address || dto.venue || dto.date || dto.endTime || dto.startTime) {
        if (dto.startTime) {
          const name = `event_${event.id}_ongoing_update`
          this.tasks.deleteTimeout(name);
          const ongoingTimeout = Math.max(0, new Date(event.startTime).getTime() - new Date().getTime() + 1500);

          // Reset timeout for event status update
          this.tasks.updateOngoingEvents(
            event.id,
            name,
            ongoingTimeout
          );
        };

        if (dto.endTime) {
          const name = `event_${event.id}_completed_update`
          this.tasks.deleteTimeout(name);
          const completedTimeout = Math.max(0, new Date(event.endTime).getTime() - new Date().getTime() + 1500);

          // Reset timeout for event status update
          this.tasks.updateCompletedEvents(
            event.id,
            name,
            completedTimeout
          );
        };

        // Notify attendees if there are any important changes in event details
        await this.eventsQueue.add('event-update', { event });
      }

      return event;
    } catch (error) {
      throw error;
    }
  }

  async getEventDetails(role: string, eventId: number): Promise<Event> {
    switch (role) {
      case 'attendee':
        return this.prisma.event.findUnique({
          where: { id: eventId }
        });
      case 'organizer':
        return this.prisma.event.findUnique({
          where: { id: eventId },
          include: { organizer: true }
        });
      default:
        throw new BadRequestException('Invalid value for role parameter. Expected "organizer" or "attendee".');
    }
  }

  async cancelEvent(eventId: number): Promise<void> {
    try {
      const event = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          status: 'CANCELLED',
          revenue: 0
        },
        include: {
          tickets: true,
          users: true
        }
      });

      // Clear event status update timeouts
      this.tasks.deleteTimeout(`event_${event.id}_completed_update`);
      this.tasks.deleteTimeout(`event_${event.id}_ongoing_update`);

      // Notify attendees of event cancellation
      await this.eventsQueue.add('cancel-event', { event });
    } catch (error) {
      throw error;
    }
  }

  async addTicketTier(dto: addTicketTierDto, eventId: number): Promise<void> {
    try {
      const { name, price, totalNumberOfTickets, discount, benefits, discountExpiration, discountPrice, numberOfDiscountTickets } = dto;

      const tier = await this.prisma.ticketTier.create({
        data: {
          name,
          price: +price,
          totalNumberOfTickets: +totalNumberOfTickets,
          discount,
          benefits,
          eventId
        }
      });

      if (discount) {
        await this.prisma.ticketTier.update({
          where: { id: tier.id },
          data: {
            discountPrice: +discountPrice,
            discountExpiration,
            discountStatus: 'ACTIVE',
            numberOfDiscountTickets: +numberOfDiscountTickets
          }
        });

        // Set auto update of discount status based on the expiration date
        const discountTimeout = Math.max(0, new Date(tier.discountExpiration).getTime() - new Date().getTime());
        this.tasks.updateDiscountExpiration(
          tier.id,
          `tier_${tier.id}_discount_update`,
          discountTimeout
        );
      };
    } catch (error) {
      throw error;
    }
  }

  async removeDiscount(eventId: number, tier: string): Promise<void> {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { ticketTiers: true }
      });

      for (let ticketTier of event.ticketTiers) {
        if (ticketTier.name === tier) {
          await this.prisma.ticketTier.update({
            where: { id: ticketTier.id },
            data: {
              discount: false,
              discountPrice: null,
              discountExpiration: null,
              discountStatus: null,
              numberOfDiscountTickets: null
            }
          });

          // Delete discount status update timeout
          this.tasks.deleteTimeout(`tier_${ticketTier.id}_discount_update`);
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async findNearbyEvents(latitude: number, longitude: number): Promise<Event[]> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Geolocation Search',
      Secrets.GEOLOCATION_STORE_INDEX,
    );

    try {
      const events = await redis.geoRadius('events', { latitude, longitude }, 5, 'km');
      const nearbyEvents = await Promise.all(
        events.map(async (event) => {
          const eventId = event.split(':')[1];
          return await this.prisma.event.findUnique({
            where: { id: +eventId }
          });
        })
      );

      // Return upcoming events close to the user
      return nearbyEvents.filter(event => event.status === 'UPCOMING');
    } catch (error) {
      throw error;
    } finally {
      await redis.disconnect();
    }
  }
}