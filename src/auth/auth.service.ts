import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import * as argon from 'argon2'
import {
  CreateUserDto,
  LoginDto,
  NewPasswordDto,
  VerifyOTPDto
} from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PasswordResetInfo } from '../common/types';
import { RedisClientType } from 'redis';
import { initializeRedis } from '@src/common/config/redis-conf';
import { Secrets } from '@src/common/env';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: DbService,
    private readonly jwt: JwtService,
    @InjectQueue('auth-queue') private readonly authQueue: Queue
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
      await this.authQueue.add('signup', email);

      delete user.password; // Sanitize user details

      return {
        user,
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

  async login(dto: LoginDto): Promise<string> {
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

      // Create and sign JWT payload
      const payload = { sub: user.id, email: user.email };
      const token = await this.jwt.signAsync(payload);

      return token;
    } catch (error) {
      throw error;
    }
  }

  async logout(token: string): Promise<void> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Blacklisted Tokens',
      Secrets.BLACKLISTED_TOKENS_STORE_INDEX,
    );

    try {
      // Calculate the cache ttl based on the token expiration time
      const decoded = await this.jwt.decode(token);
      const exp = decoded.exp * 1000;
      const ttl = Math.max(1, Math.floor((exp - Date.now()) / 1000)) + 600;

      // Blacklist the token against future use until it expires
      await redis.setEx(token, ttl, JSON.stringify({ blacklisted: true }));

      return;
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
    }
  }

  async requestPasswordReset(email: string): Promise<string> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Password Reset',
      Secrets.PASSWORD_RESET_STORE_INDEX,
    );

    try {
      const user = await this.prisma.user.findUnique({
        where: { email }
      });

      if (user) {
        const data: PasswordResetInfo = {
          email,
          otp: `${Math.random() * 10 ** 16}`.slice(3, 7),
        }

        const resetId = randomUUID();
        // Cache the reset OTP for one hour
        await redis.setEx(resetId, 3600, JSON.stringify(data))

        // Send the OTP via email
        await this.authQueue.add('otp', {
          email,
          otp: data.otp
        });

        return resetId;
      } else {
        throw new BadRequestException('No user found with that email address')
      }
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
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
      const resetIdCheck = await redis.get(resetId) as string;

      if (resetIdCheck) {
        // Fetch existing reset info
        const data = JSON.parse(resetIdCheck) as PasswordResetInfo;

        // Reset the OTP value
        await redis.setEx(resetId, 3600, JSON.stringify({
          email: data.email,
          otp: `${Math.random() * 10 ** 16}`.slice(3, 7),
        }));

        // Send another email with the new OTP
        await this.authQueue.add('otp', {
          email: data.email,
          otp: data.otp
        })

        return data.email;
      } else {
        throw new BadRequestException('Invalid or expired password reset ID');
      }
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
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
      const resetIdCheck = await redis.get(dto.resetId) as string;

      if (resetIdCheck) {
        // Fetch existing reset info
        const data = JSON.parse(resetIdCheck) as PasswordResetInfo;

        // Check if OTP is invalid or expired
        if (data.otp !== dto.otp) {
          throw new BadRequestException('Invalid OTP')
        };

        return data.email;
      } else {
        throw new BadRequestException('Invalid or expired password reset ID');
      }
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
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
      const resetIdCheck = await redis.get(dto.resetId) as string;

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
        throw new BadRequestException('Invalid or expired password reset ID');
      }
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
    }
  }
}