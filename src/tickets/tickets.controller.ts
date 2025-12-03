import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AuthGuard } from '@nestjs/passport';
import {
  AddTicketTierDTO,
  CreateDiscountDTO,
  CreateListingDTO,
  PurchaseTicketDTO,
  ValidateTicketDTO
} from './dto';
import { TokenBlacklistGuard } from '../custom/guards/token.guard';
import { Listing, TicketTier, User } from 'prisma/generated/client';
import logger from '../common/logger';
import { RedisClientType } from 'redis';
import { EventOrganizerGuard } from '@src/custom/guards/organizer.guard';
import { REDIS_CLIENT } from '@src/redis/redis.module';
import { GetUser } from '@src/custom/decorators/user.decorator';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('events/:eventId/tickets')
export class TicketsController {
  private readonly context: string = TicketsController.name;

  constructor(
    private readonly ticketsService: TicketsService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {};

  @Get('tiers')
  async getTicketTiers(
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ tickets: TicketTier[] }> {
    try {
      const tickets = await this.ticketsService.getTicketTiers(eventId);
      return { tickets };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching ticket tiers for event. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('add')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'), EventOrganizerGuard)
  async addTicketTier(
    @Body() dto: AddTicketTierDTO,
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ tier: TicketTier }> {
    try {
      const tier = await this.ticketsService.addTicketTier(dto, eventId);
      return { tier };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while adding ticket tier to event. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Delete(':tierId')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'), EventOrganizerGuard)
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
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'), EventOrganizerGuard)
  async createDiscount(
    @Param('tierId', ParseIntPipe) tierId: number,
    @Body() dto: CreateDiscountDTO,
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
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'), EventOrganizerGuard)
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
    @Body() dto: PurchaseTicketDTO,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Headers('Idempotency-Key') idempotencyKey: string
  ): Promise<{ checkout: string }> {
    // Check if request contains a valid idempotency key
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    try {
      // Return cached checkout URL if request has already been processed
      const cacheKey = `idempotency_keys:${idempotencyKey}`
      const cacheResult = await this.redis.get(cacheKey);
      if (cacheResult) {
        logger.warn(`[${this.context}] Duplicate ticket purchase attempt by ${dto.email}.\n`);

        return { checkout: cacheResult as string };
      };

      // Process ticket purchase and store checkout URL to prevent multiple payments
      const checkout = await this.ticketsService.purchaseTicket(dto, eventId);
      await this.redis.setEx(cacheKey, 10 * 60, checkout);

      logger.info(`[${this.context}] ${dto.email} initiated a ticket purchase.\n`);
      return { checkout };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while intitiating ticket purchase. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('validate')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'), EventOrganizerGuard)
  async validateTicket(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ValidateTicketDTO
  ): Promise<{ message: string }> {
    try {
      await this.ticketsService.validateTicket(eventId, dto);
      return { message: 'Ticket validated successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while validating event ticket. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('marketplace')
  async populateMarketplace(): Promise<{ listings: Listing[] }> {
    try {
      return { listings: await this.ticketsService.populateMarketplace() };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while populating ticket marketplace. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Post(':ticketId/listing')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  async createListing(
    @GetUser() user: User,
    @Body() dto: CreateListingDTO
  ): Promise<{ message: string }> {
    try {
      await this.ticketsService.createListing(user.id, dto);
      return { message: 'Your ticket has been listed for resale' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while listing ticket for resale. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Post(':ticketId/listing/buy')
  async buyListing(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Query('email') email: string
  ): Promise<{ checkout: string }> {
    try {
      if (!email) {
        throw new BadRequestException('Missing required "email" parameter');
      }

      return { checkout: await this.ticketsService.buyListing(ticketId, email) };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while buying ticket from resale marketplace. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Delete(':ticketId/listing')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  async deleteListing(
    @Param('ticketId', ParseIntPipe) ticketId: number,
  ): Promise<{ message: string }> { 
    try {
      await this.ticketsService.deleteListing(ticketId);
      return { message: 'Your ticket has been removed from resale marketplace' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while removing ticket from resale marketplace. Error: ${error.message}\n`);
      throw error;
    }
  }
}
