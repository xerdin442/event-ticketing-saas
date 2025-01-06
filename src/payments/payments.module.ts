import { Global, Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsGateway } from './payments.gateway';
import { BullModule } from '@nestjs/bull';
import { PaymentsProcessor } from '../common/workers/payments.processor';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

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
    makeCounterProvider({
      name: 'unsuccessful_transfers',
      help: 'Total number of unsuccessful transfers'
    }),
    makeCounterProvider({
      name: 'transaction_refunds',
      help: 'Total number of transaction refunds'
    })
  ]
})
export class PaymentsModule { }
