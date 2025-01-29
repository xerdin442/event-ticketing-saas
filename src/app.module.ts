import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/users.module';
import { DbModule } from './db/db.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { Secrets } from './common/env';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { PaymentsModule } from './payments/payments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    DbModule,
    EventsModule,
    TicketsModule,
    PaymentsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      redis: {
        host: Secrets.REDIS_HOST,
        port: Secrets.REDIS_PORT,
        db: Secrets.QUEUE_STORE_INDEX,
        password: Secrets.REDIS_PASSWORD,
        family: 0
      }
    }),
    ThrottlerModule.forRoot([{
      name: 'Seconds',
      ttl: 1000,
      limit: Secrets.RATE_LIMITING_PER_SECOND
    }, {
      name: 'Minutes',
      ttl: 60000,
      limit: Secrets.RATE_LIMITING_PER_MINUTE
    }]),
    ScheduleModule.forRoot(),
    TasksModule,
    MetricsModule,
  ],

  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard
  }]
})
export class AppModule { }