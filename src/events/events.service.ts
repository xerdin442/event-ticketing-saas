import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
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

  async findNearbyEvents(dto: NearbyEventsDto): Promise<Event[]> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Geolocation Search',
      Secrets.GEOLOCATION_STORE_INDEX,
    );
    const { latitude, longitude } = dto;

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

      return nearbyEvents.filter(event => event.status !== "CANCELLED");
    } catch (error) {
      throw error;
    } finally {
      await redis.disconnect();
    }
  }
}