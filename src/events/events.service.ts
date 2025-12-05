import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  CreateEventDTO,
  VerifyTicketRefundDTO,
  UpdateEventDTO,
  ProcessTicketRefundDTO,
} from './dto';
import axios from 'axios';
import { Event } from '@generated/client';
import { EventCategory } from '@generated/enums';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisClientType } from 'redis';
import { Secrets } from '../common/secrets';
import { MetricsService } from '@src/metrics/metrics.service';
import { PaymentsService } from '@src/payments/payments.service';
import { randomUUID } from 'crypto';
import { TicketRefundInfo } from '@src/common/types';
import { REDIS_CLIENT } from '@src/redis/redis.module';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: DbService,
    private readonly metrics: MetricsService,
    private readonly payments: PaymentsService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    @InjectQueue('events-queue') private readonly eventsQueue: Queue
  ) { };

  async exploreEvents(categories: EventCategory[]): Promise<Event[]> {
    try {
      const categoryFilters: { category: EventCategory }[] = [];
      if (categories.length > 0) {
        // Aggregate the catgory filters
        for (let i = 0; i < categories.length - 1; i++) {
          categoryFilters.push({ category: categories[i] });
        }
      }

      return await this.prisma.event.findMany({
        where: {
          AND: [
            { status: 'UPCOMING' },
            { OR: categoryFilters },
          ]
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async createEvent(
    dto: CreateEventDTO,
    userId: number,
    poster: string
  ): Promise<Event> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { organizer: true }
      });

      // Check if the user has an organizer profile
      if (!user.organizer) {
        throw new BadRequestException('An Organizer profile is required to create an event')
      };

      // Encode event location in URL format and generate coordinates
      const location = `${dto.venue}+${dto.address}`.replace(/(,)/g, '').replace(/\s/g, '+');
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${location}&format=json`, {
        headers: {
          'User-Agent': `${Secrets.APP_NAME}-${Secrets.APP_EMAIL}`
        }
      });

      if (response.status === 200 && response.data.length > 0) {
        const event = await this.prisma.event.create({
          data: {
            ...dto,
            organizerId: user.organizer.id,
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

        // Set automatic status updates 1.5 seconds after the start and end of the event
        await this.eventsQueue.add(
          'ongoing-status-update',
          { eventId: event.id },
          {
            jobId: `event-${event.id}-ongoing`,
            delay: Math.max(0, new Date(event.startTime).getTime() - new Date().getTime() + 1500)
          }
        );
        await this.eventsQueue.add(
          'completed-status-update',
          { eventId: event.id },
          {
            jobId: `event-${event.id}-completed`,
            delay: Math.max(0, new Date(event.endTime).getTime() - new Date().getTime() + 1500)
          }
        );

        // Send alerts to users that are subscribed to this event category
        const users = await this.prisma.user.findMany({
          where: {
            AND: [{
              alertsSubscription: true,
              preferences: {
                has: event.category,
              }
            }]
          }
        });
        await this.eventsQueue.add(
          'event-alerts',
          {
            users,
            eventId: event.id,
          }
        );

        // Update metrics value
        this.metrics.incrementCounter('total_events', ['created']);

        return event;
      };

      throw new BadRequestException('Failed to generate coordinates for the event location. Please enter correct values for "venue" and "address"');
    } catch (error) {
      throw error;
    }
  }

  async updateEvent(
    dto: UpdateEventDTO,
    eventId: number,
    poster?: string
  ): Promise<Event> {
    try {
      const event = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          ...dto,
          ...(poster && { poster })
        },
      });

      if (dto.address || dto.venue || dto.date || dto.endTime || dto.startTime) {
        if (dto.address || dto.venue) {
          const location = `${dto.venue}+${dto.address}`.replace(/(,)/g, '').replace(/\s/g, '+');
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?q=${location}&format=json`, {
            headers: {
              'User-Agent': `${Secrets.APP_NAME}-${Secrets.APP_EMAIL}`
            }
          });

          if (response.status === 200 && response.data.length > 0) {
            // Clear existing location coordinates
            await this.redis.zRem('nearby_events', `ID:${event.id}`);

            // Add coordinates to Redis geolocation store
            const { lat, lon } = response.data[0];
            await this.eventsQueue.add('geolocation-store', {
              longitude: lon as string,
              latitude: lat as string,
              eventId: event.id
            });
          } else {
            throw new BadRequestException('Failed to generate coordinates for the event location. Please enter correct values for "venue" and "address"');
          };
        };

        if (dto.startTime) {
          const jobId = `event-${event.id}-ongoing`;
          await this.eventsQueue.removeJobs(jobId);

          // Reset timeout for event status update
          await this.eventsQueue.add(
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
          await this.eventsQueue.removeJobs(jobId);

          // Reset timeout for event status update
          await this.eventsQueue.add(
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

      return event;
    } catch (error) {
      throw error;
    }
  }

  async getEventDetails(eventId: number): Promise<Event> {
    try {
      return this.prisma.event.findUnique({
        where: { id: eventId },
      });
    } catch (error) {
      throw error;
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
          organizer: true
        }
      });

      // Clear event status auto updates
      await this.eventsQueue.removeJobs(`event-${event.id}-*`);
      // Notify attendees of event cancellation
      await this.eventsQueue.add('cancel-event', { event });
    } catch (error) {
      throw error;
    }
  }

  async findNearbyEvents(latitude: number, longitude: number): Promise<Event[]> {
    try {
      const events = await this.redis.geoRadius(
        'nearby_events',
        { latitude, longitude },
        5,
        'km'
      );

      const nearbyEvents = await Promise.all(
        events.map(async (event) => {
          const eventId = event.split(':')[1];
          return await this.prisma.event.findUnique({
            where: { id: +eventId }
          });
        })
      );

      if (nearbyEvents.length === 0) return [];

      return nearbyEvents.filter(event => event.status === "UPCOMING");
    } catch (error) {
      throw error;
    }
  }

  async initiateTicketRefund(eventId: number, email: string): Promise<string> {
    try {
      // Verify that the event has been cancelled
      const event = await this.prisma.event.findUnique({
        where: { id: eventId }
      });
      if (event.status !== 'CANCELLED') {
        throw new BadRequestException('Ticket refunds can only be processed for a cancelled event')
      }

      // Verify that the user is an attendee
      const tickets = await this.prisma.ticket.findMany({
        where: {
          eventId,
          attendee: email,
        }
      });

      if (tickets.length > 0) {
        const requestId = randomUUID(); // Generate unique request ID

        // Calculate the refund amount in kobo
        const refundAmount = tickets.reduce((total, ticket) => {
          return total + (ticket.discountPrice ? ticket.discountPrice : ticket.price) * 100;
        }, 0);

        // Send verification OTP to validate request
        await this.eventsQueue.add(
          'ticket-refund-otp',
          {
            requestId,
            email,
            eventId,
            refundAmount
          }
        );

        return requestId;
      };

      throw new BadRequestException('Only attendees can process ticket refunds for this event. Check the email and try again');
    } catch (error) {
      throw error;
    }
  }

  async verifyTicketRefund(dto: VerifyTicketRefundDTO): Promise<{ requestId: string; email: string }> {
    try {
      const cacheResult = await this.redis.get(`ticket_refund:${dto.requestId}`);
      if (!cacheResult) throw new BadRequestException('Invalid or expired request ID');

      // Retrieve ticket refund info
      const data = JSON.parse(cacheResult as string) as TicketRefundInfo;
      if (data.otp !== dto.otp) throw new BadRequestException('Invalid OTP');

      // Store the info with a new request ID after OTP verification
      const verifiedRequestId = randomUUID();
      await this.redis.setEx(`ticket_refund:${verifiedRequestId}`, 3600, JSON.stringify(data));

      return {
        requestId: verifiedRequestId,
        email: data.email,
      };
    } catch (error) {
      throw error;
    }
  }

  async processTicketRefund(dto: ProcessTicketRefundDTO) {
    try {
      const cacheResult = await this.redis.get(`ticket_refund:${dto.requestId}`);
      if (!cacheResult) throw new BadRequestException('Invalid or expired request ID');

      // Retrieve ticket refund info
      const data = JSON.parse(cacheResult as string);
      const { email, eventId, refundAmount } = data as TicketRefundInfo;

      // Verify attendee's account details
      await this.payments.verifyAccountDetails({ ...dto });

      // Create recipient code to process transfer
      const recipientCode = await this.payments.createTransferRecipient({ ...dto })

      if (!Secrets.PAYSTACK_SECRET_KEY.includes('test')) {
        // Initiate transfer of ticket refund
        const reference = await this.payments.initiateTransfer(
          recipientCode,
          refundAmount,
          'Ticket Refund',
          { email, eventId }
        );

        // Record transfer details
        await this.prisma.transaction.create({
          data: {
            email,
            amount: refundAmount,
            reference,
            source: "REFUND",
            status: "TRANSFER_PENDING",
            eventId
          }
        });
      }

      return;
    } catch (error) {
      throw error
    }
  }

  async getTrendingEvents(): Promise<Event[]> {
    try {
      // Fetch the top ten trending events
      const LIMIT = 10;
      const results = await this.redis.zRange('trending_events', 0, LIMIT - 1, {
        REV: true,
        BY: 'SCORE',
      });

      // Fetch details of the events
      const trendingEvents: Event[] = [];
      for (let i = 0; i < results.length; i += 2) {
        const event = await this.prisma.event.findUnique({
          where: { id: +results[i] }
        });

        trendingEvents.push(event);
      }

      return trendingEvents;
    } catch (error) {
      throw error;
    }
  }
}