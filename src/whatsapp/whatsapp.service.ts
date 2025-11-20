import { Injectable } from '@nestjs/common';
import { Event, EventCategory } from '@prisma/client';
import { DbService } from '@src/db/db.service';
import { EventFilterDTO } from './dto';

@Injectable()
export class WhatsappService {
  constructor(private readonly prisma: DbService) { }

  async findEventsByFilters(dto: EventFilterDTO, pageSize = 7): Promise<Event[]> {
    try {
      const categoryFilters: { category: EventCategory }[] = [];
      if (dto.categories.length > 0) {
        for (let i = 0; i < dto.categories.length - 1; i++) {
          categoryFilters.push({ category: dto.categories[i] });
        }
      };

      const events = await this.prisma.event.findMany({
        where: {
          AND: [
            { status: 'UPCOMING' },
            { 
              OR: categoryFilters,
              title: {
                contains: dto.title,
              },
              date: {
                gte: new Date(dto.startDate),
                lte: new Date(dto.endDate),
              },
              address: {
                contains: dto.location,
              },
              venue: {
                contains: dto.venue,
              }
            },
          ]
        },
        skip: (dto.page - 1) * pageSize,
        take: pageSize,
        orderBy: { date: 'desc' },
      });
      return events;
    } catch (error) {
      throw error;
    }
  }
}
