import { ConfigService } from "@nestjs/config";

const config = new ConfigService();

export const Secrets = {
  NODE_ENV: process.env.NODE_ENV as string,
  PORT: config.getOrThrow<number>('PORT'),
  DATABASE_URL: config.getOrThrow<string>('DATABASE_URL'),
  JWT_SECRET: config.getOrThrow<string>('JWT_SECRET'),
  CLOUD_NAME: config.getOrThrow<string>('CLOUD_NAME'),
  CLOUD_API_SECRET: config.getOrThrow<string>('CLOUD_API_SECRET'),
  CLOUD_API_KEY: config.getOrThrow<string>('CLOUD_API_KEY'),
  REDIS_PORT: config.getOrThrow<number>('REDIS_PORT'),
  REDIS_HOST: config.getOrThrow<string>('REDIS_HOST'),
  REDIS_PASSWORD: config.getOrThrow<string>('REDIS_PASSWORD'),
  REDIS_URL: config.getOrThrow<string>('REDIS_URL'),
  RESEND_EMAIL_API_KEY: config.getOrThrow<string>('RESEND_EMAIL_API_KEY'),
  APP_NAME: config.getOrThrow<string>('APP_NAME'),
  APP_EMAIL: config.getOrThrow<string>('APP_EMAIL'),
  ADMIN_EMAIL: config.getOrThrow<string>('ADMIN_EMAIL'),
  RATE_LIMITING_PER_SECOND: config.getOrThrow<number>('RATE_LIMITING_PER_SECOND'),
  RATE_LIMITING_PER_MINUTE: config.getOrThrow<number>('RATE_LIMITING_PER_MINUTE'),
  PAYSTACK_SECRET_KEY: config.getOrThrow<string>('PAYSTACK_SECRET_KEY'),
  ACCOUNT_NUMBER: config.get('ACCOUNT_NUMBER'),
  ACCOUNT_NAME: config.get('ACCOUNT_NAME'),
  BANK_NAME: config.get('BANK_NAME'),
}