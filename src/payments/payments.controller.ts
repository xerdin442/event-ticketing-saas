import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import logger from '../common/logger';
import { Request } from 'express';
import crypto from 'crypto';
import { Secrets } from '../common/env';
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
  @UseGuards(AuthGuard('jwt'))
  async getBankNames(): Promise<string[]> {
    try {
      return this.payments.getBankNames();
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving bank names. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async paymentCallback(@Req() req: Request): Promise<void> {
    try {
      const hash = crypto.createHmac('sha512', Secrets.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body)).digest('hex');

      const { event, data } = req.body;

      // Listen for status of transactions for ticket purchases
      if (event.includes('charge')) {
        await this.paymentsQueue.add('transaction', {
          eventType: event,
          metadata: data.metadata
        });
      };

      // Listen for status of transfers for ticket refunds and revenue splits
      if (event.includes('transfer')) {
        await this.paymentsQueue.add('transfer', {
          eventType: event,
          metadata: data.recipient.metadata,
          recipientCode: data.recipient.recipient_code,
          reason: data.reason,
          amount: data.amount
        });
      };

      // Send a 200 OK response to the Paystack server
      if (hash === req.headers['x-paystack-signature']) {
        return;
      };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while listening on webhook URL. Error: ${error.message}\n`);
      throw error;
    }
  }
}