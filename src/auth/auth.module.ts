import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../common/strategy/jwt-strategy';
import { BullModule } from '@nestjs/bull';
import { AuthProcessor } from '../common/workers/auth.processor';
import { Secrets } from '../common/secrets';
import { PaymentsService } from '../payments/payments.service';
import { MetricsService } from '../metrics/metrics.service';
import { MailService } from '@src/common/config/mail';

@Module({
  imports: [
    JwtModule.register({
      secret: Secrets.JWT_SECRET,
      signOptions: { expiresIn: '1h' }
    }),
    BullModule.registerQueue({
      name: 'auth-queue'
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    AuthProcessor,
    PaymentsService,
    MetricsService,
    MailService,
  ]
})
export class AuthModule {}
