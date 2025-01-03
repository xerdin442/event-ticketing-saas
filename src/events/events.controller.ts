import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '@nestjs/passport';
import { addTicketTierDto, CreateEventDto, UpdateEventDto } from './dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
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
    AnyFilesInterceptor({
      fileFilter: UploadService.fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // Limit each file to 5MB
      storage: UploadService.storage('events', 'auto')
    })
  )
  async createEvent(
    dto: CreateEventDto,
    @GetUser() user: User,
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<{ event: Event }> {
    try {
      const poster = files.find(file => file.fieldname === 'poster').path;
      const media = files.filter(file => file.fieldname === 'media').map(file => file.path);

      const event = await this.eventsService.createEvent(dto, user.id, poster, media);
      logger.info(`[${this.context}] ${user.email} created a new event: ${event.title}.\n`);

      return { event };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while creating new event. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Patch(':eventId/update')
  @UseInterceptors(
    AnyFilesInterceptor({
      fileFilter: UploadService.fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // Limit each file to 5MB
      storage: UploadService.storage('events', 'auto')
    })
  )
  async updateEvent(
    dto: UpdateEventDto,
    @GetUser() user: User,
    @Param('eventId', ParseIntPipe) eventId: number,
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<{ event: Event }> {
    try {
      const poster = files.find(file => file.fieldname === 'poster').path;
      const media = files.filter(file => file.fieldname === 'media').map(file => file.path);

      const event = await this.eventsService.updateEvent(dto, eventId, poster, media);
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
      logger.error(`[${this.context}] An error occurred while upadting event details. Error: ${error.message}\n`);
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

      return { message: 'Event cancellation successful.' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during the event cancellation process. Error: ${error.message}\n`);
      throw error;
    } 
  }

  @HttpCode(HttpStatus.OK)
  @Post(':eventId/tickets/add')
  @UseGuards(EventOrganizerGuard)
  async addTicketTier(
    dto: addTicketTierDto,
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ message: string }> {
    try {
      await this.eventsService.addTicketTier(dto, eventId);
      return { message: 'Ticket tier added successfully!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while adding ticket tier to event. Error: ${error.message}\n`);
      throw error;
    } 
  }

  @HttpCode(HttpStatus.OK)
  @Post(':eventId/tickets/add')
  @UseGuards(EventOrganizerGuard)
  async removeDiscount(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('tier') tier: string
  ): Promise<{ message: string }> {
    try {
      await this.eventsService.removeDiscount(eventId, tier);
      return { message: 'Disocunt offer successfully removed from event' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while removing discount offer from event. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('nearby')
  async findNearbyEvents(
    @Query('latitude', ParseIntPipe) latitude: number,
    @Query('longitude', ParseIntPipe) longitude: number
  ): Promise<{ events: Event[] }> {
    try {
      const events = await this.eventsService.findNearbyEvents(latitude, longitude);
      return { events };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving nearby events. Error: ${error.message}\n`);
      throw error;
    }
  }
}
