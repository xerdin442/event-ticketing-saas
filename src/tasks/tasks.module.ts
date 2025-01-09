import { Global, Module } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Global()
@Module({
  providers: [TasksService],
  exports: [TasksService]
})
export class TasksModule { }
