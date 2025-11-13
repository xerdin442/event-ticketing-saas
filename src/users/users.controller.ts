import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Event, Ticket, User } from '@prisma/client';
import { GetUser } from '../custom/decorators';
import { UpdateProfileDto } from './dto';
import { UserService } from './users.service';
import logger from '../common/logger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../common/config/upload';

@UseGuards(AuthGuard('jwt'))
@Controller('user')
export class UserController {
  private context = UserController.name;

  constructor(private userService: UserService) { };

  @Get('profile')
  getProfile(@GetUser() user: User): { user: User } {
    logger.info(`[${this.context}] User profile viewed by ${user.email}\n`);
    return { user };
  }

  @Patch('profile')
  @UseInterceptors(FileInterceptor('profileImage', {
    fileFilter: UploadService.fileFilter,
    limits: { fieldSize: 5 * 1024 * 1024 }, // File sizes must be less than 5MB
    storage: UploadService.storage('profile-images', 'image'),
  }))
  async updateProfile(
    @GetUser() user: User,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File
  ): Promise<{ user: User }> {
    try {
      const updatedUser = await this.userService.updateProfile(user.id, dto, file?.path);
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
        throw new BadRequestException('Missing "role" query parameter.')
      };

      const events = await this.userService.getAllEvents(role, user.id)
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
      const tickets = await this.userService.getAllTickets(user.id)
      logger.info(`[${this.context}] ${user.email} retrieved all purchased tickets.\n`);

      return { tickets };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving all purchased tickets. Error: ${error.message}\n`);
      throw error;
    }
  }
}
