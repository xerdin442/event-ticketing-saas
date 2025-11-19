import { BadRequestException, Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { EventsService } from '@src/events/events.service';
import { WhatsappService } from './whatsapp.service';
import { Event } from '@prisma/client';
import logger from '@src/common/logger';

@Controller('whatsapp')
export class WhatsappController {
  private readonly context: string = WhatsappController.name;

  constructor(
    private readonly eventsService: EventsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get('events')
  async findEventsByNameOrDate(
    @Query('page', ParseIntPipe) page: number,
    @Query('search') search?: string,
    @Query('date') date?: string,
  ): Promise<{ events: Event[] }> {
    try {
      if (!page) {
        throw new BadRequestException('Invalid or missing "page" parameter');
      }

      let events: Event[];
      if (search) {
        events = await this.whatsappService.findEventsByName(search, page);
      }
      if (date) {
        events = await this.whatsappService.findEventsByDate(date, page);
      }

      return { events };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching events by name or date. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('events/trending')
  async getTrendingEvents(): Promise<{ events: Event[] }> {
    try {
      return { events: await this.eventsService.getTrendingEvents() };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching trending events. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('events/nearby')
  async findNearbyEvents(
    @Query('latitude', ParseIntPipe) latitude: number,
    @Query('longitude', ParseIntPipe) longitude: number,
  ): Promise<{ events: Event[] }> {
    try {
      if (!latitude || !longitude) {
        throw new BadRequestException('Invalid or missing query parameters');
      }

      const nearbyEvents = await this.eventsService.findNearbyEvents(latitude, longitude);
      return { events: nearbyEvents.slice(0, 11) };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching nearby events. Error: ${error.message}\n`);
      throw error;
    }
  }
}
