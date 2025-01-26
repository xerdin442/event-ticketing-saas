import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  AddTicketTierDto,
  CreateEventDto,
  NearbyEventsDto,
  UpdateEventDto
} from './dto';
import axios from 'axios';
import { Event } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisClientType } from 'redis';
import { initializeRedis } from '../common/config/redis-conf';
import { Secrets } from '../common/env';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: DbService,
    @InjectQueue('events-queue') private readonly eventsQueue: Queue,
    @InjectQueue('tasks-queue') private readonly tasksQueue: Queue
  ) { };

  async createEvent(
    dto: CreateEventDto,
    userId: number,
    poster: string
  ): Promise<Event> {
    try {
      // Encode event location in URL format and generate coordinates
      const location = `${dto.venue}+${dto.address}`.replace(/(,)/g, '').replace(/\s/g, '+');
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${location}&format=json`, {
        headers: {
          'User-Agent': `${Secrets.APP_NAME}-${Secrets.APP_EMAIL}`
        }
      });

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { organizer: true }
      });

      if (response.status === 200 && response.data.length > 0) {
        const event = await this.prisma.event.create({
          data: {
            ...dto,
            organizerId: user.organizer.id,
            ageRestriction: +dto.ageRestriction,
            capacity: +dto.capacity,
            poster,
            revenue: 0
          }
        });

        // Add coordinates to Redis geolocation store
        const { lat, lon } = response.data[0];
        await this.eventsQueue.add('geolocation-store', {
          longitude: lon as string,
          latitude: lat as string,
          eventId: event.id
        });

        // Set automatic status updates, 1.5 seconds after the start and end of the event
        await this.tasksQueue.add(
          'ongoing-status-update',
          { eventId: event.id },
          {
            jobId: `event-${event.id}-ongoing`,
            delay: Math.max(0, new Date(event.startTime).getTime() - new Date().getTime() + 1500)
          }
        );
        await this.tasksQueue.add(
          'completed-status-update',
          { eventId: event.id },
          {
            jobId: `event-${event.id}-completed`,
            delay: Math.max(0, new Date(event.endTime).getTime() - new Date().getTime() + 1500)
          }
        );

        return event;
      } else {
        throw new BadRequestException('Failed to generate coordinates for the event location. Please enter correct values for "venue" and "address"');
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
      const event = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          ...dto,
          ...(dto.capacity !== undefined && { capacity: +dto.capacity }),
          ...(dto.ageRestriction !== undefined && { ageRestriction: +dto.ageRestriction }),
          ...(poster && { poster })
        },
        include: {
          users: true,
          organizer: true
        }
      });

      if (dto.address || dto.venue || dto.date || dto.endTime || dto.startTime) {
        if (dto.startTime) {
          const jobId = `event-${event.id}-ongoing`;
          await this.tasksQueue.removeJobs(jobId);

          // Reset timeout for event status update
          await this.tasksQueue.add(
            'ongoing-status-update',
            { eventId: event.id },
            {
              jobId,
              delay: Math.max(0, new Date(event.startTime).getTime() - new Date().getTime() + 1500)
            }
          );
        };

        if (dto.endTime) {
          const jobId = `event-${event.id}-completed`;
          await this.tasksQueue.removeJobs(jobId);

          // Reset timeout for event status update
          await this.tasksQueue.add(
            'completed-status-update',
            { eventId: event.id },
            {
              jobId,
              delay: Math.max(0, new Date(event.endTime).getTime() - new Date().getTime() + 1500)
            }
          );
        };

        // Notify attendees if there are any important changes in event details
        await this.eventsQueue.add('event-update', { event });
      }

      delete event.organizer;
      delete event.users;
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
          users: true,
          organizer: true
        }
      });

      // Clear event status auto updates
      await this.tasksQueue.removeJobs(`event-${event.id}-*`);

      // Notify attendees of event cancellation
      await this.eventsQueue.add('cancel-event', { event });
    } catch (error) {
      throw error;
    }
  }

  async addTicketTier(dto: AddTicketTierDto, eventId: number): Promise<void> {
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
        await this.tasksQueue.add(
          'discount-status-update',
          { tierId: tier.id },
          {
            jobId: `tier-${tier.id}-discount`,
            delay: Math.max(0, new Date(tier.discountExpiration).getTime() - new Date().getTime())
          }
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
      const ticketTier = event.ticketTiers.find(ticketTier => ticketTier.name === tier);
      
      if (!ticketTier) {
        throw new BadRequestException(`No ticket tier named ${tier} in this event`);
      };

      if (ticketTier.discount) {
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

        // Delete discount status auto update
        await this.tasksQueue.removeJobs(`tier-${ticketTier.id}-discount`);
      } else {
        throw new BadRequestException('No discount offer available in this tier');
      };
    } catch (error) {
      throw error;
    }
  }

  async findNearbyEvents(dto: NearbyEventsDto): Promise<Event[]> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Geolocation Search',
      Secrets.GEOLOCATION_STORE_INDEX,
    );
    const { latitude, longitude } = dto;

    try {
      const events = await redis.geoRadius('events', { latitude, longitude }, 5, 'km');
      // Fetch all upcoming events close to the user
      const nearbyEvents = await Promise.all(
        events.map(async (event) => {
          const eventId = event.split(':')[1];
          return await this.prisma.event.findUnique({
            where: {
              id: +eventId,
              status: "UPCOMING"
            }
          });
        })
      );

      return nearbyEvents;
    } catch (error) {
      throw error;
    } finally {
      await redis.disconnect();
    }
  }
}