import { Global, Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsGateway } from './payments.gateway';

@Global()
@Module({
  providers: [PaymentsService, PaymentsGateway],
  controllers: [PaymentsController],
  exports: [PaymentsService]
})
export class PaymentsModule {}
