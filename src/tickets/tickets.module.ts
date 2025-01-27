import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { BullModule } from '@nestjs/bull';
import { TicketsProcessor } from '../common/workers/tickets.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tickets-queue'
    })
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsProcessor
  ]
})
export class TicketsModule { }
