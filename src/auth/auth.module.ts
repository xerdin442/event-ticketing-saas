import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../common/strategy/jwt-strategy';
import { BullModule } from '@nestjs/bull';
import { MailProcessor } from '../common/workers/mail.processor';
import { SessionService } from '../common/session';
import { Secrets } from '../common/env';
import { PaymentsService } from '../payments/payments.service';
import { MetricsService } from '../metrics/metrics.service';

@Module({
  imports: [
    JwtModule.register({
      secret: Secrets.JWT_SECRET,
      signOptions: { expiresIn: '1h' }
    }),
    BullModule.registerQueue({
      name: 'mail-queue'
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    MailProcessor,
    SessionService,
    PaymentsService,
    MetricsService
  ]
})
export class AuthModule {}
