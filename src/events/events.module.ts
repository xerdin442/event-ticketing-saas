import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { BullModule } from '@nestjs/bull';
import { EventsProcessor } from '../common/workers/events.processor';
import { TasksProcessor } from '../common/workers/tasks.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'events-queue'
    })
  ],
  controllers: [EventsController],
  providers: [
    EventsService,
    EventsProcessor,
    TasksProcessor
  ]
})
export class EventsModule { }
