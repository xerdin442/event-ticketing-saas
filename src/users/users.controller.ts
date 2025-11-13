import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Event, Ticket, User } from '@prisma/client';
import { GetUser } from '../custom/decorators';
import { UpdateProfileDto } from './dto';
import { UserService } from './users.service';
import logger from '../common/logger';
import { MetricsService } from '@src/metrics/metrics.service';

@UseGuards(AuthGuard('jwt'))
@Controller('user')
export class UserController {
  private readonly context = UserController.name;

  constructor(
    private readonly userService: UserService,
    private readonly metrics: MetricsService,
  ) { };

  @Get('profile')
  getProfile(@GetUser() user: User): { user: User } {
    logger.info(`[${this.context}] User profile viewed by ${user.email}\n`);
    return { user };
  }

  @Patch('profile')
  async updateProfile(
    @GetUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ user: User }> {
    try {
      const updatedUser = await this.userService.updateProfile(user.id, dto);
      logger.info(`[${this.context}] User profile updated by ${user.email}.\n`);

      return { user: updatedUser };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while updating profile details. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Delete('profile')
  async deleteAccount(@GetUser() user: User): Promise<{ message: string }> {
    try {
      await this.userService.deleteAccount(user.id);
      logger.info(`[${this.context}] User profile deleted by ${user.email}.\n`);

      return { message: 'Account deleted successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting user profile. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('events')
  async getAllEvents(
    @Query('role') role: string,
    @GetUser() user: User
  ): Promise<{ events: Event[] }> {
    try {
      if (!role) {
        throw new BadRequestException('Missing required "role" parameter.')
      };

      const events = await this.userService.getAllEvents(role, user.email)
      logger.info(`[${this.context}] ${user.email} retrieved all events as an ${role}.\n`);

      return { events };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving all user events. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Get('tickets')
  async getAllTickets(@GetUser() user: User): Promise<{ tickets: Ticket[] }> {
    try {
      const tickets = await this.userService.getAllTickets(user.email)
      logger.info(`[${this.context}] ${user.email} retrieved all purchased tickets.\n`);

      return { tickets };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving all purchased tickets. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Post('alerts')
  async toggleAlertSubscription(
    @GetUser() user: User,
    @Query('action') action: string,
  ): Promise<{ message: string }> {
    try {
      if (!action) {
        throw new BadRequestException('Missing required "action" parameter.')
      };

      if (action === 'subscribe') {
        await this.userService.toggleAlertSubscription(user.id, 'on');
        logger.info(`[${this.context}] ${user.email} subscribed to event alerts\n`);

        // Update metric value
        this.metrics.updateGauge('subscribed_users', 'inc');

        return { message: 'Event alerts subscription successful' };
      } else if (action === 'unsubscribe') {
        await this.userService.toggleAlertSubscription(user.id, 'off');
        logger.info(`[${this.context}] ${user.email} unsubscribed from event alerts\n`);

        // Update metric value
        this.metrics.updateGauge('subscribed_users', 'dec');

        return { message: 'Event alerts turned off successfully' };
      } else {
        throw new BadRequestException('Invalid "action" value. Expected "subscribe" or "unsubscribe"')
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving all user events. Error: ${error.message}\n`);
      throw error;
    }
  }
}
