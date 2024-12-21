import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@prisma/client';
import { GetUser } from '../common/decorators';
import { updateProfileDto } from './dto';
import { UserService } from './user.service';
import logger from '../common/logger';

@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UserController {
  private context = UserController.name;

  constructor(private userService: UserService) {};

  @Get('profile')
  profile(@GetUser() user: User): { user: User } {
    logger.info(`[${this.context}] User profile viewed by ${user.email}\n`);
    return { user };
  }

  @Patch('profile/update')
  async updateProfile(
    @GetUser() user: User,
    @Body() dto: updateProfileDto
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

  @Delete('profile/delete')
  async deleteAccount(@GetUser() user: User)
  : Promise<{ message: string }> {
    try {
      await this.userService.deleteAccount(user.id);
      logger.info(`[${this.context}] User profile deleted by ${user.email}.\n`);

      return { message: 'Account deleted successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting user profile. Error: ${error.message}\n`);

      throw error;
    }
  }
}
