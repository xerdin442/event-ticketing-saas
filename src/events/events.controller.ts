import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '@nestjs/passport';
import {
  CreateEventDto,
  NearbyEventsDto,
  UpdateEventDto
} from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../common/config/upload';
import { GetUser } from '../custom/decorators';
import { Event, User } from '@prisma/client';
import logger from '../common/logger';
import { EventOrganizerGuard } from '../custom/guards';

@UseGuards(AuthGuard('jwt'))
@Controller('events')
export class EventsController {
  private readonly context: string = EventsController.name;

  constructor(private readonly eventsService: EventsService) { };

  @Post('create')
  @UseInterceptors(
    FileInterceptor('poster', {
      fileFilter: UploadService.fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // Limit each file to 5MB
      storage: UploadService.storage('events', 'image')
    })
  )
  async createEvent(
    @Body() dto: CreateEventDto,
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

  @Patch(':eventId')
  @UseGuards(EventOrganizerGuard)
  @UseInterceptors(
    FileInterceptor('poster', {
      fileFilter: UploadService.fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // Limit each file to 5MB
      storage: UploadService.storage('events', 'auto')
    })
  )
  async updateEvent(
    @Body() dto: UpdateEventDto,
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

  @Get(':eventId')
  async getEventDetails(
    @GetUser() user: User,
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ event: Event }> {
    try {
      const event = await this.eventsService.getEventDetails(eventId);
      logger.info(`[${this.context}] Event details retrieved by ${user.email}.\n`);

      return { event };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving event details. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post(':eventId/cancel')
  @UseGuards(EventOrganizerGuard)
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
  @Post('nearby')
  async findNearbyEvents(@Body() dto: NearbyEventsDto): Promise<{ events: Event[] } | { message: string }> {
    try {
      const events = await this.eventsService.findNearbyEvents(dto);
      if (events.length > 0) return { events };

      return { message: 'No events found' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving nearby events. Error: ${error.message}\n`);
      throw error;
    }
  }
}
