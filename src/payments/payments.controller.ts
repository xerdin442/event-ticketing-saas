import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import logger from '../common/logger';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { Secrets } from '../common/env';

@Controller('payments')
export class PaymentsController {
  private readonly context: string = PaymentsController.name;

  constructor(private readonly payments: PaymentsService) { };

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
  async webhook(@Req() req: Request, @Res() res: Response) {
    try {
      const hash = crypto.createHmac('sha512', Secrets.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body)).digest('hex');

      if (hash === req.headers['x-paystack-signature']) {
        res.sendStatus(200) // Send a 200 OK response to Paystack server
      };
    } catch (error) {
      throw error;
    }
  }
}