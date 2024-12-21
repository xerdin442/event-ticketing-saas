import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  providers: [PaymentsService],
  controllers: [PaymentsController]
})
export class PaymentsModule {}
