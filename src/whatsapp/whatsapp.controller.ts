import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { EventsService } from '@src/events/events.service';
import { WhatsappService } from './whatsapp.service';
import { Event, TicketTier } from '@generated/client';
import logger from '@src/common/logger';
import { WhatsappApiKeyGuard } from '@src/custom/guards/whatsapp.guard';
import { EventFilterDTO } from './dto';
import { TicketsService } from '@src/tickets/tickets.service';
import { PurchaseTicketDTO } from '@src/tickets/dto';

@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(WhatsappApiKeyGuard)
@Controller('whatsapp/events')
export class WhatsappController {
  private readonly context: string = WhatsappController.name;

  constructor(
    private readonly eventsService: EventsService,
    private readonly ticketsService: TicketsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Get()
  async findEventsByFilters(
    @Query() dto: EventFilterDTO,
  ): Promise<{ events: Event[] }> {
    try {
      return { events: await this.whatsappService.findEventsByFilters(dto) };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching events by filters. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('trending')
  async getTrendingEvents(): Promise<{ events: Event[] }> {
    try {
      return { events: await this.eventsService.getTrendingEvents() };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching trending events. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('nearby')
  async findNearbyEvents(
    @Query('latitude', ParseFloatPipe) latitude: number,
    @Query('longitude', ParseFloatPipe) longitude: number,
  ): Promise<{ events: Event[] }> {
    try {
      if (!latitude || !longitude) {
        throw new BadRequestException('Invalid or missing query parameters');
      }

      const nearbyEvents = await this.eventsService.findNearbyEvents(latitude, longitude);

      return { events: nearbyEvents.slice(0, 7) };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching nearby events. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get(':eventId/tickets')
  async getTicketTiers(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<{ tickets: TicketTier[] }> {
    try {
      return { tickets: await this.ticketsService.getTicketTiers(eventId) };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching ticket tiers for event. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Post(':eventId/tickets/purchase')
  async initiateTicketPurchase(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: PurchaseTicketDTO,
  ): Promise<{ checkout: string }> {
    try {
      return { checkout: await this.ticketsService.purchaseTicket(dto, eventId) };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while generating checkout link for ticket purchase. Error: ${error.message}\n`);
      throw error;
    }
  }
}
