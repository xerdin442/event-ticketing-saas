import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { OrganizerService } from './organizer.service';
import { User, Organizer } from '@generated/client';
import logger from '@src/common/logger';
import { GetUser } from '@src/custom/decorators/user.decorator';
import { CreateOrganizerProfileDTO, UpdateOrganizerProfileDTO } from './dto';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistGuard } from '@src/custom/guards/token.guard';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('organizer')
export class OrganizerController {
  private readonly context: string = OrganizerController.name;

  constructor(private readonly organizerService: OrganizerService) { }

  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@GetUser() user: User): Promise<{ organizer: Organizer }> {
    try {
      const organizer = await this.organizerService.getProfile(user.id);
      logger.info(`[${this.context}] Orgnaizer profile viewed by ${user.email}\n`);

      return { organizer };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving organizer profile. Error: ${error.message}.\n`);
      throw error;
    }
  }

  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  @Post('profile')
  async createProfile(
    @GetUser() user: User,
    @Body() dto: CreateOrganizerProfileDTO
  ): Promise<{ organizer: Organizer }> {
    try {
      const organizer = await this.organizerService.createProfile(user.id, dto);
      logger.info(`[${this.context}] Organizer profile created by ${user.email}.\n`);

      return { organizer };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while creating organizer profile. Error: ${error.message}.\n`);
      throw error;
    }
  }

  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(
    @GetUser() user: User,
    @Body() dto: UpdateOrganizerProfileDTO
  ): Promise<{ organizer: Organizer }> {
    try {
      const organizer = await this.organizerService.updateProfile(user.id, dto);
      logger.info(`[${this.context}] Organizer profile updated by ${user.email}.\n`);

      return { organizer };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while updating organizer profile. Error: ${error.message}.\n`);
      throw error;
    }
  }

  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  @Delete('profile')
  async deleteProfile(@GetUser() user: User): Promise<{ message: string }> {
    try {
      const organizer = await this.organizerService.deleteProfile(user.id);
      logger.info(`[${this.context}] Organizer profile deleted by ${user.email}.\n`);

      return { message: 'Organizer profile deleted successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting organizer profile. Error: ${error.message}.\n`);
      throw error;
    }
  }

  @Get(':organizerId')
  async getProfileById(
    @Param('organizerId') id: number
  ): Promise<{ organizer: Organizer }> {
    try {
      const organizer = await this.organizerService.getProfileById(id);
      return { organizer };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving organizer profile by ID. Error: ${error.message}.\n`);
      throw error;
    }
  }
}
