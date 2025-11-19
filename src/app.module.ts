import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/users.module';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { Secrets } from './common/secrets';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { PaymentsModule } from './payments/payments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { MetricsModule } from './metrics/metrics.module';
import { AppController } from './app.controller';
import { OrganizerModule } from './organizer/organizer.module';
import { RedisModule } from './redis/redis.module';
import { applyThrottlerConfig } from './common/util/helper';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    DbModule,
    EventsModule,
    TicketsModule,
    PaymentsModule,
    TasksModule,
    MetricsModule,
    OrganizerModule,
    RedisModule,
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      redis: {
        host: Secrets.REDIS_HOST,
        port: Secrets.REDIS_PORT,
        password: Secrets.NODE_ENV !== 'test' ? Secrets.REDIS_PASSWORD : undefined,
        family: 0
      }
    }),
    ThrottlerModule.forRoot(applyThrottlerConfig()),
    WhatsappModule,
  ],

  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard
  }],
  controllers: [AppController]
})
export class AppModule { }