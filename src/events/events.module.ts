import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { BullModule } from '@nestjs/bull';
import { EventsProcessor } from '../common/workers/events.processor';
import { MailService } from '@src/common/config/mail';

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
    MailService,
  ],
  exports: [EventsService]
})
export class EventsModule { }
