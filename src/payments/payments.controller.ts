import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import logger from '../common/logger';
import { Request } from 'express';
import crypto from 'crypto';
import { Secrets } from '../common/secrets';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Controller('payments')
export class PaymentsController {
  private readonly context: string = PaymentsController.name;

  constructor(
    private readonly payments: PaymentsService,
    @InjectQueue('payments-queue') private readonly paymentsQueue: Queue
  ) { };

  @Get('banks')
  async getBankNames(): Promise<string[]> {
    try {
      return this.payments.getBankNames();
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving bank names. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('callback')
  async handleWebhooks(@Req() req: Request) {
    try {
      const hash = crypto.createHmac('sha512', Secrets.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body)).digest('hex');

      const { event, data } = req.body;

      if (hash === req.headers['x-paystack-signature']) {
        // Listen for status of transactions for ticket purchases
        if (event.includes('charge')) {
          await this.paymentsQueue.add('transaction', {
            eventType: event,
            metadata: data.metadata,
            transactionReference: data.reference,
          });
        };

        // Listen for status of transfers for ticket refunds and revenue splits
        if (event.includes('transfer')) {
          await this.paymentsQueue.add('transfer', {
            eventType: event,
            metadata: data.metadata,
            recipientCode: data.recipient.recipient_code,
            reason: data.reason,
            amount: data.amount,
            transactionReference: data.reference,
          });
        };

        // Listen for status of refunds for unsuccessful ticket purchases
        if (event.includes('refund')) {
          await this.paymentsQueue.add('refund', {
            eventType: event,
            amount: data.amount,
            refundId: data.refund_reference,
            metadata: data.metadata,
            transactionReference: data.transaction_reference,
          });
        };

        return; // Send a 200 OK response to the Paystack server if all checks are complete
      };

      throw new BadRequestException('Invalid authorization signature');
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while listening on webhook URL. Error: ${error.message}\n`);
      throw error;
    }
  }
}