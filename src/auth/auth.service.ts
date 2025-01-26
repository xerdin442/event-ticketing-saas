import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import * as argon from 'argon2'
import {
  CreateUserDto,
  LoginDto,
  NewPasswordDto,
  PasswordResetDto,
  Verify2FADto,
  VerifyOTPDto
} from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SessionData } from '../common/types';
import { SessionService } from '../common/session';
import { Secrets } from '../common/env';
import { PaymentsService } from '../payments/payments.service';
import { sanitizeUserOutput } from '../common/util/helper';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: DbService,
    private readonly jwt: JwtService,
    private readonly sessionService: SessionService,
    private readonly payments: PaymentsService,
    private readonly metrics: MetricsService,
    @InjectQueue('mail-queue') private readonly mailQueue: Queue
  ) { }

  async signup(dto: CreateUserDto, filePath?: string)
    : Promise<{ user: User, token: string }> {
    try {
      const { accountName, accountNumber, bankName, age, email, password, firstName } = dto;
      
      // Verify if user account details are correct
      await this.payments.verifyAccountDetails({ accountName, accountNumber, bankName });

      // Hash password and create new user
      const hash = await argon.hash(password)
      const user = await this.prisma.user.create({
        data: {
          ...dto,
          age: +age,
          password: hash,
          profileImage: filePath || Secrets.DEFAULT_IMAGE,
        }
      });

      // Create JWT payload
      const payload = { sub: user.id, email };

      // Send an onboarding email to the new user
      await this.mailQueue.add('signup', { email, firstName });

      return { 
        user: sanitizeUserOutput(user),
        token: await this.jwt.signAsync(payload)
      };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(`This ${error.meta.target[0]} already exists. Please try again!`)
        }
      };

      throw error;
    }
  }

  async login(dto: LoginDto)
    : Promise<{ token: string, twoFactorAuth: boolean }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: dto.email
        }
      })
      // Check if user is found with given email address
      if (!user) {
        throw new BadRequestException('Invalid email address')
      }

      // Check if password is valid
      const checkPassword = await argon.verify(user.password, dto.password)
      if (!checkPassword) {
        throw new BadRequestException('Invalid password')
      }

      // Create JWT payload
      const payload = { sub: user.id, email: user.email }

      return { 
        token: await this.jwt.signAsync(payload),
        twoFactorAuth: user.twoFAEnabled
      };
    } catch (error) {
      throw error;
    }
  }

  async logout(email: string): Promise<void> {
    try {
      await this.sessionService.delete(email);
    } catch (error) {
      throw error;
    }
  }

  async enable2FA(userId: number): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      const secret = speakeasy.generateSecret({
        name: `${Secrets.APP_NAME}:${user.email}`,
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFAEnabled: true,
          twoFASecret: secret.base32
        }
      });

      this.metrics.updateGauge('two_fa_enabled_users', 'inc'); // Update metrics value

      // Create a QRcode image with the generated secret
      return await qrcode.toDataURL(secret.otpauth_url, { errorCorrectionLevel: 'high' });
    } catch (error) {
      throw error;
    }
  }

  async disable2FA(userId: number): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFAEnabled: false,
          twoFASecret: null
        }
      });

      this.metrics.updateGauge('two_fa_enabled_users', 'dec'); // Update metrics value
      return;
    } catch (error) {
      throw error;
    }
  }

  async verify2FA(userId: number, dto: Verify2FADto): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      return speakeasy.totp.verify({
        secret: user.twoFASecret,
        token: dto.token,
        encoding: 'base32'
      });
    } catch (error) {
      throw error;
    }
  }

  async requestPasswordReset(dto: PasswordResetDto, data: SessionData): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email }
      });

      if (user) {
        // Set the OTP value and expiration time, and store them in session
        data.email = dto.email;
        data.otp = `${Math.random() * 10 ** 16}`.slice(3, 7);
        data.otpExpiration = Date.now() + (60 * 60 * 1000);

        await this.sessionService.set(dto.email, data);

        // Send the OTP via email
        await this.mailQueue.add('otp', {
          user,
          otp: data.otp
        })

        return data.otp;
      } else {
        throw new BadRequestException('No user found with that email')
      }
    } catch (error) {
      throw error;
    }
  }

  async resendOTP(data: SessionData): Promise<string> {
    try {
      // Retrieve existing session data
      const session = await this.sessionService.get(data.email);
      if (session.email) {
        // Reset the OTP value and expiration time
        data.otp = `${Math.random() * 10 ** 16}`.slice(3, 7);
        data.otpExpiration = Date.now() + (60 * 60 * 1000);
        await this.sessionService.set(data.email, data);

        const user = await this.prisma.user.findUnique({
          where: { email: session.email }
        })

        // Send another email with the new OTP
        await this.mailQueue.add('otp', {
          user,
          otp: data.otp
        })

        return data.otp;
      } else {
        throw new BadRequestException('Email not found')
      }
    } catch (error) {
      throw error;
    }
  }

  async verifyOTP(dto: VerifyOTPDto, data: SessionData): Promise<void> {
    try {
      // Retrieve existing session data
      const session = await this.sessionService.get(data.email);
      // Check if OTP is invalid or expired
      if (session.email) {
        if (session.otp !== dto.otp) {
          throw new BadRequestException('Invalid OTP')
        };

        if (session.otpExpiration < Date.now()) {
          throw new BadRequestException('This OTP has expired')
        };
      }

      return;
    } catch (error) {
      throw error;
    }
  }

  async changePassword(dto: NewPasswordDto, data: SessionData): Promise<void> {
    try {
      // Retrieve existing session data
      const session = await this.sessionService.get(data.email);
      // Find user with email stored in session
      const user = await this.prisma.user.findUnique({
        where: { email: session.email }
      });

      if (user) {
        // Check if the previous password is same as the new password
        const samePassword = await argon.verify(user.password, dto.newPassword);
        if (samePassword) {
          throw new BadRequestException('New password cannot be the same value as previous password');
        };

        // Hash new password and update the user's password
        const hash = await argon.hash(dto.newPassword);
        await this.prisma.user.update({
          where: { email: session.email },
          data: { password: hash }
        });

        // Clear session data after completing password reset
        delete data.email;
        delete data.otp;
        delete data.otpExpiration;
        await this.sessionService.set(user.email, data);

        return;
      } else {
        throw new BadRequestException('Email not found');
      }
    } catch (error) {
      throw error;
    }
  }
}