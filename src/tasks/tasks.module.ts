import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { BullModule } from '@nestjs/bull';
import { MailProcessor } from 'src/common/workers/mail.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail-queue'
    })
  ],
  providers: [
    TasksService,
    MailProcessor
  ]
})
export class TasksModule { }
