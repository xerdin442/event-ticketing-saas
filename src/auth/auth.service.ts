import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import * as argon from 'argon2'
import {
  CreateUserDTO,
  LoginDTO,
  NewPasswordDTO,
  VerifyOTPDTO
} from './dto';
import { PrismaClientKnownRequestError } from 'prisma/generated/internal/prismaNamespace';
import { JwtService } from '@nestjs/jwt';
import { User } from 'prisma/generated/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PasswordResetInfo } from '../common/types';
import { RedisClientType } from 'redis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from '@src/redis/redis.module';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: DbService,
    private readonly jwt: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    @InjectQueue('auth-queue') private readonly authQueue: Queue
  ) { }

  async signup(dto: CreateUserDTO)
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
      await this.authQueue.add('signup', { email });

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

  async login(dto: LoginDTO): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email }
      })
      // Check if user is found with given email address
      if (!user) {
        throw new BadRequestException('No user found with email address')
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
    try {
      // Calculate the cache ttl based on the token expiration time
      const decoded = await this.jwt.decode(token);
      const exp = decoded.exp * 1000;
      const ttl = Math.max(1, Math.floor((exp - Date.now()) / 1000)) + 600;

      // Blacklist the token against future use until it expires
      const cacheKey = `blacklisted_tokens:${token}`
      await this.redis.setEx(cacheKey, ttl, JSON.stringify({ blacklisted: true }));

      return;
    } catch (error) {
      throw error;
    }
  }

  async requestPasswordReset(email: string): Promise<string> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email }
      });

      if (user) {
        const resetInfo: PasswordResetInfo = {
          email,
          otp: `${Math.random() * 10 ** 16}`.slice(3, 7),
        }

        // Cache the reset OTP for one hour
        const resetId = randomUUID();
        const cacheKey = `password_reset:${resetId}`
        await this.redis.setEx(cacheKey, 3600, JSON.stringify(resetInfo));

        // Send the OTP via email
        await this.authQueue.add('otp', { ...resetInfo });

        return resetId;
      } else {
        throw new BadRequestException('No user found with email address')
      }
    } catch (error) {
      throw error;
    }
  }

  async resendOTP(resetId: string): Promise<string> {
    try {
      // Verify password reset ID
      const cacheKey = `password_reset:${resetId}`
      const cacheResult = await this.redis.get(cacheKey) as string;

      if (cacheResult) {
        // Fetch existing reset info
        const resetInfo = JSON.parse(cacheResult) as PasswordResetInfo;

        // Reset the OTP value
        await this.redis.setEx(cacheKey, 3600, JSON.stringify({
          ...resetInfo,
          otp: `${Math.random() * 10 ** 16}`.slice(3, 7),
        }));

        // Send another email with the new OTP
        await this.authQueue.add('otp', { ...resetInfo });

        return resetInfo.email;
      } else {
        throw new BadRequestException('Invalid or expired password reset ID');
      }
    } catch (error) {
      throw error;
    }
  }

  async verifyOTP(dto: VerifyOTPDTO): Promise<string> {
    try {
      // Verify password reset ID
      const cacheKey = `password_reset:${dto.resetId}`
      const cacheResult = await this.redis.get(cacheKey) as string;

      if (cacheResult) {
        // Fetch existing reset info
        const resetInfo = JSON.parse(cacheResult) as PasswordResetInfo;

        // Check if OTP is invalid or expired
        if (resetInfo.otp !== dto.otp) {
          throw new BadRequestException('Invalid OTP')
        };

        return resetInfo.email;
      } else {
        throw new BadRequestException('Invalid or expired password reset ID');
      }
    } catch (error) {
      throw error;
    }
  }

  async changePassword(dto: NewPasswordDTO): Promise<string> {
    try {
      // Verify password reset ID
      const cacheKey = `password_reset:${dto.resetId}`
      const cacheResult = await this.redis.get(cacheKey) as string;

      if (cacheResult) {
        // Fetch existing reset info
        const resetInfo = JSON.parse(cacheResult) as PasswordResetInfo;

        const user = await this.prisma.user.findUnique({
          where: { email: resetInfo.email }
        });

        // Check if the user's previous password is same as the new password
        const samePassword = await argon.verify(user.password, dto.newPassword);
        if (samePassword) {
          throw new BadRequestException('New password cannot be the same value as previous password');
        };

        // Hash new password and update user details
        const hash = await argon.hash(dto.newPassword);
        await this.prisma.user.update({
          where: { email: resetInfo.email },
          data: { password: hash }
        });

        // Clear reset info
        await this.redis.del(cacheKey);

        return user.email;
      } else {
        throw new BadRequestException('Invalid or expired password reset ID');
      }
    } catch (error) {
      throw error;
    }
  }
}