import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { BullModule } from '@nestjs/bull';
import { TasksProcessor } from '../common/workers/tasks.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tasks-queue'
    })
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TasksProcessor
  ]
})
export class TicketsModule { }
