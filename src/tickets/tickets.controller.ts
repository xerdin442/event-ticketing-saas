import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AuthGuard } from '@nestjs/passport';
import {
  AddTicketTierDto,
  CreateDiscountDto,
  PurchaseTicketDto,
  ValidateTicketDto
} from './dto';
import { GetUser } from '../custom/decorators';
import { EventOrganizerGuard } from '../custom/guards';
import { TicketTier, User } from '@prisma/client';
import logger from '../common/logger';
import { RedisClientType } from 'redis';
import { initializeRedis } from '../common/config/redis-conf';
import { Secrets } from '../common/env';

@UseGuards(AuthGuard('jwt'))
@Controller('events/:eventId/tickets')
export class TicketsController {
  private readonly context: string = TicketsController.name;

  constructor(private readonly ticketsService: TicketsService) {};

  @Get()
  async getEventTickets(
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ tickets: TicketTier[] }> {
    try {
      const tickets = await this.ticketsService.findAllTickets(eventId);
      return { tickets };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting ticket tier. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('add')
  @UseGuards(EventOrganizerGuard)
  async addTicketTier(
    @Body() dto: AddTicketTierDto,
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ message: string }> {
    try {
      await this.ticketsService.addTicketTier(dto, eventId);
      return { message: 'Ticket tier added successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while adding ticket tier to event. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Delete(':tierId/remove')
  @UseGuards(EventOrganizerGuard)
  async removeTicketTier(
    @Param('tierId', ParseIntPipe) tierId: number,
  ): Promise<{ message: string }> {
    try {
      await this.ticketsService.removeTicketTier(tierId);
      return { message: 'Ticket tier deleted successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting ticket tier. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post(':tierId/discount/create')
  @UseGuards(EventOrganizerGuard)
  async createDiscount(
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: CreateDiscountDto,
  ): Promise<{ message: string }> {
    try {
      await this.ticketsService.createDiscount(tierId, dto);
      return { message: 'Disocunt offer created successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while creating discount offer. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post(':tierId/discount/remove')
  @UseGuards(EventOrganizerGuard)
  async removeDiscount(
    @Param('tierId', ParseIntPipe) tierId: number,
  ): Promise<{ message: string }> {
    try {
      await this.ticketsService.removeDiscount(tierId);
      return { message: 'Disocunt offer removed successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while removing discount offer from ticket. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('purchase')
  async purchaseTicket(
    @Body() dto: PurchaseTicketDto,
    @Param('eventId', ParseIntPipe) eventId: number,
    @GetUser() user: User,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<{ checkout: string }> {
    // Check if request contains a valid idempotency key
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Idempotency Keys',
      Secrets.IDEMPOTENCY_KEYS_STORE_INDEX,
    );

    try {
      // Return cached checkout URL if request has been processed before
      const existingTransaction = await redis.get(idempotencyKey);
      if (existingTransaction) {
        logger.warn(`[${this.context}] Duplicate ticket purchase attempt by ${user.email}.\n`);
        return { checkout: JSON.parse(existingTransaction).checkout };
      };

      // Process ticket purchase and store checkout URL to prevent multiple payments
      const checkout = await this.ticketsService.purchaseTicket(dto, eventId, user.id);
      await redis.setEx(idempotencyKey, 3600, JSON.stringify({ checkout }));

      logger.info(`[${this.context}] ${user.email} initiated ticket purchase.\n`);
      return { checkout };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while intitiating ticket purchase. Error: ${error.message}\n`);
      throw error;
    } finally {
      await redis.disconnect();
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('validate')
  @UseGuards(EventOrganizerGuard)
  async validateTicket(@Body() dto: ValidateTicketDto): Promise<{ message: string }> {
    try {
      await this.ticketsService.validateTicket(dto);
      return { message: 'Ticket validated successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while validating event ticket. Error: ${error.message}\n`);
      throw error;
    }
  }
}
