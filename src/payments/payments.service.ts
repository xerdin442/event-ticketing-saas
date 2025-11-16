import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountDetails, BankData, PaystackCheckoutResponse } from '../common/types';
import { Secrets } from '../common/secrets';
import logger from '../common/logger';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class PaymentsService {
  private readonly context: string = PaymentsService.name
  private readonly httpInstance: AxiosInstance;

  constructor() {
    this.httpInstance = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Secrets.PAYSTACK_SECRET_KEY}`,
      },
    });
  }

  async getBankNames(): Promise<string[]> {
    try {
      const response = await this.httpInstance.get(
        `/bank?country=nigeria&perPage=60`,
      );
      const banks = response.data.data as BankData[];

      return banks.map((bank) => bank.name);
    } catch (error) {
      throw error;
    }
  }

  async getBankCode(bankName: string): Promise<string> {
    try {
      const response = await this.httpInstance.get(
        `/bank?country=nigeria&perPage=60`,
      );
      const banks = response.data.data as BankData[];
      const recipientBank = banks.find((bank) => bank.name === bankName);

      if (!recipientBank) {
        throw new BadRequestException(
          'Bank not found. Kindly input the correct bank name',
        );
      }

      return recipientBank.code;
    } catch (error) {
      logger.error(
        `[${this.context}] An error occurred while retrieving bank code. Error: ${error.message}\n`,
      );
      throw error;
    }
  }

  async verifyAccountDetails(details: AccountDetails): Promise<void> {
    try {
      const bankCode = await this.getBankCode(details.bankName);

      // Check if the account details match and throw an error if there is a mismatch
      const verification = await this.httpInstance.get(
        `/bank/resolve?account_number=${details.accountNumber}&bank_code=${bankCode}`,
      );

      if (
        verification.status !== 200 ||
        verification.data.data.account_name !==
          details.accountName.toUpperCase()
      ) {
        throw new BadRequestException(
          'Please check the spelling or order of your account name. The names should be ordered as it was during your account opening at the bank',
        );
      }

      return;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          'Failed to verify account details. Please check your account number and try again',
        );
      }

      logger.error(
        `[${this.context}] An error occurred while verifying account details. Error: ${error.message}\n`,
      );

      throw error;
    }
  }

  async createTransferRecipient(details: AccountDetails): Promise<string> {
    try {
      const bankCode = await this.getBankCode(details.bankName);

      const response = await this.httpInstance.post('/transferrecipient', {
        type: 'nuban',
        bank_code: bankCode,
        name: details.accountName,
        account_number: details.accountNumber,
        currency: 'NGN',
      });

      return response.data.data.recipient_code as string;
    } catch (error) {
      logger.error(
        `[${this.context}] An error occurred while creating transfer recipient. Error: ${error.message}\n`,
      );
      throw error;
    }
  }

  async deleteTransferRecipient(recipientCode: string): Promise<void> {
    try {
      await this.httpInstance.delete(`/transferrecipient/${recipientCode}`);
    } catch (error) {
      logger.error(
        `[${this.context}] An error occurred while deleting transfer recipient. Error: ${error.message}\n`,
      );
      throw error;
    }
  }

  async initiateTransfer(
    recipient: string,
    amount: number,
    reason: string,
    metadata: Record<string, any>,
  ): Promise<string> {
    try {
      const response = await this.httpInstance.post('/transfer', {
        amount: amount * 100,
        reason,
        source: 'balance',
        recipient,
        currency: 'NGN',
        metadata,
      });

      return response.data.data.reference as string;
    } catch (error) {
      logger.error(
        `[${this.context}] An error occurred while initiating transfer from balance. Error: ${error.message}\n`,
      );
      throw error;
    }
  }

  async initiateRefund(transaction: string, metadata: Record<string, any>): Promise<void> {
    try {
      await this.httpInstance.post('/refund', { transaction, metadata } );
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while initiating transaction refund. Error: ${error.message}\n`);
      throw error;
    }
  }

  async initializeTransaction(email: string, amount: number, metadata: Record<string, any>)
    : Promise<PaystackCheckoutResponse> {
    try {
      const response = await this.httpInstance.post('/transaction/initialize',
        {
          amount: amount * 100,
          email,
          metadata
        },
      )

      return response.data.data as PaystackCheckoutResponse;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while initializing transaction. Error: ${error.message}\n`);
      throw error;
    }
  }
}
