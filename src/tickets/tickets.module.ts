import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { BullModule } from '@nestjs/bull';
import { TicketsProcessor } from '../common/workers/tickets.processor';
import { EventsModule } from '@src/events/events.module';

@Module({
  imports: [
    EventsModule,
    BullModule.registerQueue({
      name: 'tickets-queue'
    })
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsProcessor
  ],
  exports: [TicketsService],
})
export class TicketsModule { }
