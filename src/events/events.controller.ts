import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CreateEventDTO,
  ProcessTicketRefundDTO,
  UpdateEventDTO,
  VerifyTicketRefundDTO
} from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../common/config/upload';
import { GetUser } from '../custom/decorators/user.decorator';
import { Event, EventCategory, User } from 'prisma/generated/client';
import logger from '../common/logger';
import { TokenBlacklistGuard } from '../custom/guards/token.guard';
import { EventCategoryPipe } from '@src/custom/pipes/event-category.pipe';
import { EventOrganizerGuard } from '@src/custom/guards/organizer.guard';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('events')
export class EventsController {
  private readonly context: string = EventsController.name;

  constructor(private readonly eventsService: EventsService) {};

  @Get()
  async exploreEvents(
    @Query('category', EventCategoryPipe) categories?: EventCategory[]
  ): Promise<{ events: Event[] }> {
    try {
      const events = await this.eventsService.exploreEvents(categories);
      return { events };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching nearby events. Error: ${error.message}\n`);
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
        throw new BadRequestException('Missing required "latitude" or "longitude" parameters');
      }

      const events = await this.eventsService.findNearbyEvents(latitude, longitude);
      return { events };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching nearby events. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('trending')
  async getTrendingEvents(): Promise<{ events: Event[] }> {
    try {
      const events = await this.eventsService.getTrendingEvents();
      return { events };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while fetching trending events. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Post('create')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('poster', {
      fileFilter: UploadService.fileFilter,
      limits: { fileSize: 10 * 1024 * 1024 }, // Limit each file to 10MB
      storage: UploadService.storage('events', 'image')
    })
  )
  async createEvent(
    @Body() dto: CreateEventDTO,
    @GetUser() user: User,
    @UploadedFile() poster: Express.Multer.File
  ): Promise<{ event: Event }> {
    try {
      const event = await this.eventsService.createEvent(dto, user.id, poster.path);
      logger.info(`[${this.context}] ${user.email} created a new event: ${event.title}.\n`);

      return { event };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while creating new event. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get(':eventId')
  async getEventDetails(
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ event: Event }> {
    try {
      const event = await this.eventsService.getEventDetails(eventId);
      return { event };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving event details. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Patch(':eventId')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'), EventOrganizerGuard)
  @UseInterceptors(
    FileInterceptor('poster', {
      fileFilter: UploadService.fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // Limit each file to 5MB
      storage: UploadService.storage('events', 'auto')
    })
  )
  async updateEvent(
    @Body() dto: UpdateEventDTO,
    @GetUser() user: User,
    @Param('eventId', ParseIntPipe) eventId: number,
    @UploadedFile() poster?: Express.Multer.File
  ): Promise<{ event: Event }> {
    try {
      const event = await this.eventsService.updateEvent(dto, eventId, poster?.path);
      logger.info(`[${this.context}] Event details updated by ${user.email}.\n`);

      return { event };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while upadting event details. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post(':eventId/cancel')
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'), EventOrganizerGuard)
  async cancelEvent(
    @GetUser() user: User,
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ message: string }> {
    try {
      await this.eventsService.cancelEvent(eventId);
      logger.info(`[${this.context}] Event cancelled by ${user.email}.\n`);

      return { message: 'Event cancellation successful' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during the event cancellation process. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post(':eventId/refund')
  async initiateTicketRefund(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('email') email: string,
  ): Promise<{ requestId: string; message: string }> {
    try {
      if (!email) throw new BadRequestException('Missing required "email" parameter');

      const requestId = await this.eventsService.initiateTicketRefund(eventId, email);
      logger.info(`[${this.context}] Ticket refund initiated by ${email}.\n`);

      return {
        requestId,
        message: 'A verification OTP has been sent to your email'
      };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while initiating ticket refund. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post(':eventId/refund/verify')
  async verifyTicketRefund(
    @Body() dto: VerifyTicketRefundDTO,
  ): Promise<{ requestId: string; message: string }>  {
    try {
      const { requestId, email } = await this.eventsService.verifyTicketRefund(dto);
      logger.info(`[${this.context}] Ticket refund request verified by ${email}.\n`);

      return {
        requestId,
        message: 'OTP verification successful! You can now safely process your ticket refund'
      };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying ticket refund request. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post(':eventId/refund/process')
  async processTicketRefund(@Body() dto: ProcessTicketRefundDTO): Promise<{ message: string }>  {
    try {
      const email = await this.eventsService.processTicketRefund(dto);
      logger.info(`[${this.context}] Ticket refund processed by ${email}.\n`);

      return {
        message: 'A refund of your ticket amount has been initiated. A confirmation mail will be sent to you shortly'
      };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while processing ticket refund request. Error: ${error.message}\n`);
      throw error;
    }
  }
}
