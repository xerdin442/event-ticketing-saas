import { Injectable } from '@nestjs/common';
import { Event } from '@prisma/client';
import { DbService } from '@src/db/db.service';
import { EventsService } from '@src/events/events.service';

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: DbService,
    private readonly eventsService: EventsService,
  ) {}

  async findEventsByName(searchString: string, page=1, pageSize=10): Promise<Event[]> {
    try {
      const events = await this.prisma.event.findMany({
        where: {
          AND: [
            {
              title: {
                contains: searchString,
                mode: 'insensitive',
              },
            },
            { status: "UPCOMING" }
          ]
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      });

      return events;
    } catch (error) {
      throw error;
    }
  }

  async findEventsByDate(date: string, page=1, pageSize=10): Promise<Event[]> {
    try {
      const events = await this.prisma.event.findMany({
        where: {
          AND: [
            { status: 'UPCOMING' },
            { date }
          ]
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' }
      });

      return events;
    } catch (error) {
      throw error;
    }
  }
}
