import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CreateUserDto,
  LoginDto,
  NewPasswordDto,
  VerifyOTPDto
} from './dto';
import { User } from '@prisma/client';
import logger from '../common/logger';
import { TokenBlacklistGuard } from '@src/custom/guards/token.guard';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { GetUser } from '@src/custom/decorators/user.decorator';

@Controller('auth')
export class AuthController {
  private context: string = AuthController.name;

  constructor(private readonly authService: AuthService) { };

  @Post('signup')
  async signup(
    @Body() dto: CreateUserDto,
  ): Promise<{ user: User, token: string }> {
    try {
      const response = await this.authService.signup(dto);
      logger.info(`[${this.context}] User signup successful. Email: ${dto.email}\n`);

      return response;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during user signup. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<{ token: string }> {
    try {
      const token = await this.authService.login(dto);
      logger.info(`[${this.context}] User login successful. Email: ${dto.email}\n`);

      return { token };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during user login. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(TokenBlacklistGuard, AuthGuard('jwt'))
  @Post('logout')
  async logout(
    @Req() req: Request,
    @GetUser() user: User,
  ): Promise<{ message: string }> {
    try {
      const header = req.headers['authorization'];
      const token = header.split(' ')[1];

      await this.authService.logout(token);
      logger.info(`[${this.context}] User logout successful. Email: ${user.email}\n`);

      return { message: 'Logout successful!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during user logout. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset')
  async requestPasswordReset(
    @Query('email') email: string,
  ): Promise<{ resetId: string; message: string }> {
    try {
      if (!email) throw new BadRequestException('Missing required "email" parameter')

      const resetId = await this.authService.requestPasswordReset(email);
      logger.info(`[${this.context}] Password reset requested by ${email}.\n`);

      return {
        resetId,
        message: 'Password reset OTP has been sent to your email',
      };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while requesting for password reset. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset/resend')
  async resendOTP(@Query('resetId') resetId: string): Promise<{ message: string }> {
    try {
      const email = await this.authService.resendOTP(resetId);
      logger.info(`[${this.context}] Password reset OTP re-sent to ${email}.\n`);

      return { message: 'Another reset OTP has been sent to your email' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while re-sending password reset OTP. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset/verify')
  async verifyOTP(@Body() dto: VerifyOTPDto): Promise<{ message: string }> {
    try {
      const email = await this.authService.verifyOTP(dto);
      logger.info(`[${this.context}] OTP verification successful. Email: ${email}\n`);

      return { message: 'OTP verification successful!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying password reset OTP. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset/new')
  async changePassword(@Body() dto: NewPasswordDto): Promise<{ message: string }> {
    try {
      const email = await this.authService.changePassword(dto);
      logger.info(`[${this.context}] Password reset completed by ${email}.\n`);

      return { message: 'Password reset complete!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while changing password. Error: ${error.message}\n`);

      throw error;
    }
  }
}
