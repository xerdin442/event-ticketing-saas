import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  CreateUserDto,
  LoginDto,
  NewPasswordDto,
  PasswordResetDto,
  Verify2FADto,
  VerifyOTPDto
} from './dto';
import { User } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../common/config/upload';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../custom/decorators';
import logger from '../common/logger';
import { SessionData } from '../common/types';

@Controller('auth')
export class AuthController {
  private context: string = AuthController.name;
  private sessionData: SessionData = {};

  constructor(private readonly authService: AuthService) { };

  @Post('signup')
  @UseInterceptors(FileInterceptor('profileImage', {
    fileFilter: UploadService.fileFilter,
    limits: { fieldSize: 5 * 1024 * 1024 }, // File sizes must be less than 5MB
    storage: UploadService.storage('profile-images', 'image'),
  }))
  async signup(
    @Body() dto: CreateUserDto,
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ user: User, token: string }> {
    try {
      const response = await this.authService.signup(dto, file.path);
      logger.info(`[${this.context}] User signup successful. Email: ${dto.email}\n`);
      
      return response;
    } catch (error) {
      if (file) {
        UploadService.deleteFile(file.path, 'Signup');
      }

      logger.error(`[${this.context}] An error occurred during user signup. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto)
    : Promise<{ token: string, twoFactorAuth: boolean }> {
    try {
      const response = await this.authService.login(dto);
      logger.info(`[${this.context}] User login successful. Email: ${dto.email}\n`);

      return response;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during user login. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@GetUser() user: User)
    : Promise<{ message: string }> {
    try {
      await this.authService.logout(user.email);
      logger.info(`[${this.context}] ${user.email} logged out of current session.\n`);

      return { message: 'Logout successful!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while logging out. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/enable')
  async enable2FA(@GetUser() user: User)
    : Promise<{ qrcode: string }> {
    try {
      const qrcode = await this.authService.enable2FA(user.id);
      logger.info(`[${this.context}] ${user.email} enabled two factor authentication.\n`);

      return { qrcode };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while enabling two factor authentication. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/disable')
  async disable2FA(@GetUser() user: User)
    : Promise<{ message: string }> {
    try {
      await this.authService.disable2FA(user.id);
      logger.info(`[${this.context}] ${user.email} disabled two factor authentication.\n`);

      return { message: '2FA disabled successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while disabling two factor authentication. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa/verify')
  async verify2FA(
    @GetUser() user: User,
    @Body() dto: Verify2FADto
  ): Promise<{ message: string }> {
    try {
      const verified = await this.authService.verify2FA(user.id, dto);

      if (verified) {
        logger.info(`[${this.context}] 2FA token verified successfully. Email: ${user.email}\n`);

        return { message: '2FA token verified successfully' };
      } else {
        logger.error(`[${this.context}] Invalid 2FA token could not be verified. Email: ${user.email}\n`);

        throw new BadRequestException('Invalid token');
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying 2FA token. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset')
  async requestPasswordReset(@Body() dto: PasswordResetDto): Promise<{ message: string }> {
    try {
      await this.authService.requestPasswordReset(dto, this.sessionData);
      logger.info(`[${this.context}] Password reset requested by ${dto.email}.\n`);

      return { message: 'Password reset OTP has been sent to your email' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while requesting for password reset. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/resend-otp')
  async resendOTP(): Promise<{ message: string }> {
    try {
      await this.authService.resendOTP(this.sessionData);
      logger.info(`[${this.context}] Password reset OTP re-sent to ${this.sessionData.email}.\n`);

      return { message: 'Another OTP has been sent to your email' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying password reset OTP. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/verify-otp')
  async verifyOTP(@Body() dto: VerifyOTPDto): Promise<{ message: string }> {
    try {
      await this.authService.verifyOTP(dto, this.sessionData);
      logger.info(`[${this.context}] OTP verification successful. Email: ${this.sessionData.email}\n`);

      return { message: 'OTP verification successful!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying password reset OTP. Error: ${error.message}\n`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/new')
  async changePassword(@Body() dto: NewPasswordDto): Promise<{ message: string }> {
    try {
      const email = this.sessionData.email;
      await this.authService.changePassword(dto, this.sessionData);
      logger.info(`[${this.context}] Password reset completed by ${email}.\n`);

      return { message: 'Password reset complete!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while changing password. Error: ${error.message}\n`);

      throw error;
    }
  }
}
