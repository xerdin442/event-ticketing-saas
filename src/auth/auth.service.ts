import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import * as argon from 'argon2'
import {
  CreateUserDto,
  LoginDto,
  NewPasswordDto,
  PasswordResetDto,
  VerifyOTPDto
} from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PasswordResetInfo } from '../common/types';
import { sanitizeUserOutput } from '../common/util/helper';
import { RedisClientType } from 'redis';
import { initializeRedis } from '@src/common/config/redis-conf';
import { Secrets } from '@src/common/env';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: DbService,
    private readonly jwt: JwtService,
    @InjectQueue('mail-queue') private readonly mailQueue: Queue
  ) { }

  async signup(dto: CreateUserDto)
    : Promise<{ user: User, token: string }> {
    try {
      const { email, password } = dto;

      // Hash password and create new user
      const hash = await argon.hash(password)
      const user = await this.prisma.user.create({
        data: {
          ...dto,
          password: hash,
        }
      });

      // Create JWT payload
      const payload = { sub: user.id, email };

      // Send an onboarding email to the new user
      await this.mailQueue.add('signup', email);

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
        where: { email: dto.email }
      })
      // Check if user is found with given email address
      if (!user) {
        throw new BadRequestException('No user found with that email address')
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

  async requestPasswordReset(dto: PasswordResetDto): Promise<string> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Password Reset',
      Secrets.PASSWORD_RESET_STORE_INDEX,
    );

    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email }
      });

      if (user) {
        // Set the OTP value and expiration time
        const data: PasswordResetInfo = {
          email: dto.email,
          otp: `${Math.random() * 10 ** 16}`.slice(3, 7),
          otpExpiration: Date.now() + (60 * 60 * 1000),
        }

        const resetId = randomUUID();
        await redis.set(resetId, JSON.stringify(data))

        // Send the OTP via email
        await this.mailQueue.add('otp', {
          email: user.email,
          otp: data.otp
        });

        return resetId;
      } else {
        throw new BadRequestException('No user found with that email address')
      }
    } catch (error) {
      throw error;
    } finally {
      await redis.disconnect();
    }
  }

  async resendOTP(resetId: string): Promise<string> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Password Reset',
      Secrets.PASSWORD_RESET_STORE_INDEX,
    );

    try {
      // Verify password reset ID
      const resetIdCheck = await redis.get(resetId);

      if (resetIdCheck) {
        // Fetch existing reset info
        const data = JSON.parse(resetIdCheck) as PasswordResetInfo;

        // Reset the OTP value and expiration time
        const otp = `${Math.random() * 10 ** 16}`.slice(3, 7);
        const otpExpiration = Date.now() + (60 * 60 * 1000);
        await redis.set(resetId, JSON.stringify({
          email: data.email,
          otp,
          otpExpiration,
        }))

        // Send another email with the new OTP
        await this.mailQueue.add('otp', {
          email: data.email,
          otp: data.otp
        })

        return data.email;
      } else {
        throw new BadRequestException('Invalid password reset ID');
      }
    } catch (error) {
      throw error;
    } finally {
      await redis.disconnect();
    }
  }

  async verifyOTP(dto: VerifyOTPDto): Promise<string> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Password Reset',
      Secrets.PASSWORD_RESET_STORE_INDEX,
    );

    try {
      // Verify password reset ID
      const resetIdCheck = await redis.get(dto.resetId);

      if (resetIdCheck) {
        // Fetch existing reset info
        const data = JSON.parse(resetIdCheck) as PasswordResetInfo;

        // Check if OTP is invalid or expired
        if (data.otp !== dto.otp) {
          throw new BadRequestException('Invalid OTP')
        };
        if (data.otpExpiration < Date.now()) {
          throw new BadRequestException('This reset OTP has expired')
        };

        return data.email;
      } else {
        throw new BadRequestException('Invalid password reset ID');
      }
    } catch (error) {
      throw error;
    } finally {
      await redis.disconnect();
    }
  }

  async changePassword(dto: NewPasswordDto): Promise<string> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Password Reset',
      Secrets.PASSWORD_RESET_STORE_INDEX,
    );

    try {
      // Verify password reset ID
      const resetIdCheck = await redis.get(dto.resetId);

      if (resetIdCheck) {
        // Fetch existing reset info
        const data = JSON.parse(resetIdCheck) as PasswordResetInfo;

        const user = await this.prisma.user.findUnique({
          where: { email: data.email }
        });

        // Check if the user's previous password is same as the new password
        const samePassword = await argon.verify(user.password, dto.newPassword);
        if (samePassword) {
          throw new BadRequestException('New password cannot be the same value as previous password');
        };

        // Hash new password and update user details
        const hash = await argon.hash(dto.newPassword);
        await this.prisma.user.update({
          where: { email: data.email },
          data: { password: hash }
        });

        // Clear reset info
        await redis.del(dto.resetId);

        return user.email;
      } else {
        throw new BadRequestException('Invalid password reset ID');
      }
    } catch (error) {
      throw error;
    } finally {
      await redis.disconnect();
    }
  }
}