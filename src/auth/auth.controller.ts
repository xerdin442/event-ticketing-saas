import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Session,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto, NewPasswordDto, PasswordResetDto, Verify2FADto, VerifyOTPDto } from './dto';
import { User } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadConfig } from '../common/config/upload';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../common/decorators';
import logger from '../common/logger';

@Controller('auth')
export class AuthController {
  private context = AuthController.name;

  constructor(private readonly authService: AuthService) { };

  @Post('signup')
  @UseInterceptors(FileInterceptor('profileImage', {
    fileFilter: new UploadConfig().fileFilter,
    limits: { fieldSize: 5 * 1024 * 1024 }, // File sizes must be less than 5MB
    storage: new UploadConfig().storage('profile-images', 'image')
  }))
  async signup(
    @Body() dto: AuthDto,
    @UploadedFile() file: Express.Multer.File
  ): Promise<object> {
    try {
      let response: object;
      if (file) {
        response = await this.authService.signup(dto, file.path)
      } else {
        response = await this.authService.signup(dto, undefined)
      }

      logger.info(`[${this.context}] User signup successful.\n\t Email: ${dto.email}`);
      return response;
    } catch (error) {
      if (file) {
        new UploadConfig().deleteFile(file.path, 'Signup');
      }

      logger.error(`[${this.context}] An error occurred during user signup.
        \n\t Error: ${error.message}`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: AuthDto)
    : Promise<{ token: string, twoFactorAuth: boolean }> {
    try {
      const response = await this.authService.login(dto);
      logger.info(`[${this.context}] User login successful.\n\t Email: ${dto.email}`);

      return response;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during user login.
        \n\t Error: ${error.message}`);

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
      logger.info(`[${this.context}] ${user.email} enabled two factor authentication`);

      return { qrcode };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while enabling two factor authentication.
        \n\t Error: ${error.message}`);

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
      logger.info(`[${this.context}] ${user.email} disabled two factor authentication`);

      return { message: '2FA disabled successfully' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while disabling two factor authentication.
        \n\t Error: ${error.message}`);

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
        logger.info(`[${this.context}] 2FA token verified successfully.
          \n\t Email: ${user.email}`);

        return { message: '2FA token verified successfully' };
      } else {
        logger.error(`[${this.context}] Invalid 2FA token could not be verified.
          \n\t Email: ${user.email}`);

        throw new BadRequestException('Invalid token');
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying 2FA token.
        \n\t Error: ${error.message}`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset')
  async requestPasswordReset(
    @Body() dto: PasswordResetDto,
    @Session() session: Record<string, any>
  ): Promise<{ message: string }> {
    try {
      await this.authService.requestPasswordReset(dto, session);
      logger.info(`[${this.context}] Password reset requested by ${dto.email}`);

      return { message: 'Password reset OTP has been sent to your email' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while requesting for password reset.
        \n\t Error: ${error.message}`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/resend-otp')
  async resendOTP(@Session() session: Record<string, any>)
    : Promise<{ message: string }> {
    try {
      await this.authService.resendOTP(session);
      logger.info(`[${this.context}] Password reset OTP re-sent to ${session.email}.`);

      return { message: 'Another OTP has been sent to your email' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying password reset OTP.
        \n\t Error: ${error.message}`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/verify-otp')
  verifyOTP(
    @Body() dto: VerifyOTPDto,
    @Session() session: Record<string, any>
  ): { message: string } {
    try {
      this.authService.verifyOTP(dto, session);
      logger.info(`[${this.context}] OTP verification successful. \n\t Email: ${session.email}`);

      return { message: 'OTP verification successful!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying password reset OTP.
        \n\t Error: ${error.message}`);

      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/new')
  async changePassword(
    @Body() dto: NewPasswordDto,
    @Session() session: Record<string, any>
  ): Promise<{ message: string }> {
    try {
      const email = session.email;
      await this.authService.changePassword(dto, session);
      logger.info(`[${this.context}] Password reset completed by ${email}.`);

      return { message: 'Password reset complete!' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while changing password.
        \n\t Error: ${error.message}`);

      throw error;
    }
  }
}
