import { Global, Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsGateway } from './payments.gateway';
import { BullModule } from '@nestjs/bull';
import { PaymentsProcessor } from '../common/workers/payments.processor';
import { MetricsService } from '../metrics/metrics.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'payments-queue'
    })
  ],
  controllers: [PaymentsController],
  exports: [
    PaymentsService,
    PaymentsGateway
  ],
  providers: [
    PaymentsService,
    PaymentsGateway,
    PaymentsProcessor,
    MetricsService
  ]
})
export class PaymentsModule { }
