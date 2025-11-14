import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  CreateEventDto,
  VerifyTicketRefundDto,
  UpdateEventDto,
  ProcessTicketRefundDto,
} from './dto';
import axios from 'axios';
import { Event, EventCategory } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisClientType } from 'redis';
import { initializeRedis } from '../common/config/redis-conf';
import { Secrets } from '../common/env';
import { MetricsService } from '@src/metrics/metrics.service';
import { PaymentsService } from '@src/payments/payments.service';
import { randomUUID } from 'crypto';
import { TicketRefundInfo } from '@src/common/types';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: DbService,
    private readonly metrics: MetricsService,
    private readonly payments: PaymentsService,
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
        where: { OR: categoryFilters }
      });
    } catch (error) {
      throw error;
    }
  }

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

      if (!user.organizer) {
        throw new BadRequestException('An organizer profile is required to create an event')
      };

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
          tickets: true,
          organizer: true
        }
      });

      if (dto.address || dto.venue || dto.date || dto.endTime || dto.startTime) {
        if (dto.address || dto.venue) {
          const redis: RedisClientType = await initializeRedis(
            Secrets.REDIS_URL,
            'Geolocation Search',
            Secrets.GEOLOCATION_STORE_INDEX,
          );
          await redis.zRem('events', `ID:${event.id}`);

          const location = `${dto.venue}+${dto.address}`.replace(/(,)/g, '').replace(/\s/g, '+');
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?q=${location}&format=json`, {
            headers: {
              'User-Agent': `${Secrets.APP_NAME}-${Secrets.APP_EMAIL}`
            }
          });

          if (response.status === 200 && response.data.length > 0) {
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

      delete event.organizer;
      delete event.tickets;

      return event;
    } catch (error) {
      throw error;
    }
  }

  async getEventDetails(eventId: number): Promise<Event> {
    return this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            email: true,
            events: { select: { id: true, title: true, poster: true } },
            name: true,
            instagram: true,
            phone: true,
            whatsapp: true,
            website: true,
            twitter: true,
          }
        }
      }
    });
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

  async findNearbyEvents(lat: string, lon: string): Promise<Event[]> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Geolocation Search',
      Secrets.GEOLOCATION_STORE_INDEX,
    );

    try {
      const events = await redis.geoRadius('events', { latitude: +lat, longitude: +lon }, 5, 'km');
      const nearbyEvents = await Promise.all(
        events.map(async (event) => {
          const eventId = event.split(':')[1];
          return await this.prisma.event.findUnique({
            where: { id: +eventId }
          });
        })
      );

      return nearbyEvents.filter(event => event.status !== "CANCELLED");
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
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
            eventTitle: event.title,
            refundAmount
          }
        );

        return requestId;
      } else {
        throw new BadRequestException('Only attendees can process ticket refunds for this event. Check the email and try again');
      }
    } catch (error) {
      throw error;
    }
  }

  async verifyTicketRefund(dto: VerifyTicketRefundDto): Promise<{ requestId: string; email: string }> {
    // Initialize Redis connection
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Ticket Refund',
      Secrets.TICKET_REFUND_STORE_INDEX,
    );

    try {
      const requestId = await redis.get(dto.requestId);
      if (!requestId) throw new BadRequestException('Invalid or expired request ID');

      // Retrieve ticket refund info
      const data = JSON.parse(requestId as string) as TicketRefundInfo;
      if (data.otp !== dto.otp) throw new BadRequestException('Invalid OTP');

      // Store the info with a new request ID after OTP verification
      const verifiedRequestId = randomUUID();
      await redis.setEx(verifiedRequestId, 3600, JSON.stringify(data));

      return {
        requestId: verifiedRequestId,
        email: data.email,
      };
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
    }
  }

  async processTicketRefund(dto: ProcessTicketRefundDto) {
    // Initialize Redis connection
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Ticket Refund',
      Secrets.TICKET_REFUND_STORE_INDEX,
    );

    try {
      const requestId = await redis.get(dto.requestId);
      if (!requestId) throw new BadRequestException('Invalid or expired request ID');

      // Retrieve ticket refund info
      const { email, eventTitle, refundAmount } = JSON.parse(requestId as string) as TicketRefundInfo;

      // Verify attendee's account details
      await this.payments.verifyAccountDetails({ ...dto });

      // Create recipient code to process transfer
      const recipientCode = await this.payments.createTransferRecipient({ ...dto })

      // Initiate transfer of ticket refund
      if (!Secrets.PAYSTACK_SECRET_KEY.includes('test')) {
        await this.payments.initiateTransfer(
          recipientCode,
          refundAmount,
          'Ticket Refund',
          { email, eventTitle }
        );
      }

      return;
    } catch (error) {
      throw error
    } finally {
      redis.destroy();
    }
  }

  async getTrendingEvents(): Promise<Event[]> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Trending Events',
      Secrets.TRENDING_EVENTS_STORE_INDEX,
    )

    try {
      // Fetch the top ten trending events
      const LIMIT = 10;
      const results = await redis.zRange('trending-list', 0, LIMIT - 1, {
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
    } finally {
      redis.destroy();
    }
  }
}