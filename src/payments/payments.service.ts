import { BadRequestException, Injectable } from '@nestjs/common';
import axios from "axios";
import { AccountDetails, BankData } from '../common/types';
import { Secrets } from '../common/env';
import logger from '../common/logger';
import { RedisClientType } from 'redis';
import { initializeRedis } from '../common/config/redis-conf';
import { User } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly context: string = PaymentsService.name

  async getBankNames(): Promise<string[]> {
    try {
      const banksPerPage: number = 60;
      const url = `https://api.paystack.co/bank?country=nigeria&perPage=${banksPerPage}`
      const response = await axios.get(url);
      const banks: BankData[] = response.data.data;

      return banks.map(bank => bank.name);
    } catch (error) {
      throw error;
    }
  }

  async getBankCode(bankName: string): Promise<string> {
    try {
      const banksPerPage: number = 60;
      const url = `https://api.paystack.co/bank?country=nigeria&perPage=${banksPerPage}`;
      const response = await axios.get(url);
      const banks: BankData[] = response.data.data;
      const recipientBank = banks.find(bank => bank.name === bankName);

      if (!recipientBank) {
        throw new BadRequestException('Bank not found. Kindly input the correct bank name')
      };

      return recipientBank.code;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while retrieving bank code. Error: ${error.message}\n`);
      throw error;
    }
  }

  async verifyAccountDetails(details: AccountDetails): Promise<void> {
    try {
      const bankCode = await this.getBankCode(details.bankName);

      // Check if the account details match and return an error message if there is a mismatch
      const url = `https://api.paystack.co/bank/resolve?account_number=${details.accountNumber}&bank_code=${bankCode}`;
      const verification = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${Secrets.PAYSTACK_SECRET_KEY}` }
      });

      if (verification.data.data.account_name !== details.accountName.toUpperCase()) {
        throw new BadRequestException('Failed to verify account details. Kindly input your account name in the correct order')
      };

      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while verifying account details. Error: ${error.message}\n`);
      throw error;
    }
  }

  async createTransferRecipient(details: AccountDetails): Promise<string> {
    try {
      const bankCode = await this.getBankCode(details.bankName)

      const url = 'https://api.paystack.co/transferrecipient';
      const recipient = await axios.post(url,
        {
          "type": "nuban",
          "bank_code": bankCode,
          "name": details.accountName,
          "account_number": details.accountNumber,
          "currency": "NGN"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Secrets.PAYSTACK_SECRET_KEY}`
          }
        }
      );

      return recipient.data.data.recipient_code;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while creating transfer recipient. Error: ${error.message}\n`);
      throw error;
    }
  }

  async deleteTransferRecipient(recipientCode: string): Promise<void> {
    try {
      const url = `https://api.paystack.co/transferrecipient/${recipientCode}`
      await axios.delete(url,
        { headers: { 'Authorization': `Bearer ${Secrets.PAYSTACK_SECRET_KEY}` } }
      );
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting transfer recipient. Error: ${error.message}\n`);
      throw error;
    }
  }

  async initiateTransfer(
    recipientCode: string,
    amount: number,
    reason: string,
    metadata: Record<string, any>
  ): Promise<string> {
    try {
      const url = 'https://api.paystack.co/transfer'
      const transfer = await axios.post(url,
        {
          "amount": amount,
          "reason": reason,
          "source": "balance",
          "recipient": recipientCode,
          "currency": "NGN",
          "metadata": metadata
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Secrets.PAYSTACK_SECRET_KEY}`
          }
        }
      )

      return transfer.data.data.transfer_code;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while initiating transfer from balance. Error: ${error.message}\n`);
      throw error;
    }
  }

  async retryTransfer(data: any, user: User): Promise<void> {
    const { metadata, reason, recipientCode, amount } = data;
    const { retryKey } = metadata;
    const MAX_RETRIES = 2;

    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Transfer Management'
    );

    try {
      await redis.select(Secrets.TRANSFER_RETRIES_STORE_INDEX);

      // Use the retry key to check if the transfer has already been retried
      const checkRetry = await redis.get(retryKey);
      if (checkRetry) {
        const retries = JSON.parse(checkRetry).retries;
        if (retries < MAX_RETRIES) {
          // Retry transfer for the last time
          await this.initiateTransfer(recipientCode, amount, reason, metadata);

          // Update number of retries for this transfer
          const ttl = await redis.ttl(retryKey);
          await redis.set(retryKey, JSON.stringify({ retries: retries + 1 }), { EX: ttl });

          logger.info(`[${this.context}] ${reason}: Final transfer retry to ${user.email} initiated.\n`);
          return;          
        } else if (retries === MAX_RETRIES) {
          // If retries are exhausted, store details of the failed transfer for 30 days
          await redis.select(Secrets.FAILED_TRANSFERS_STORE_INDEX);
          await redis.setEx(user.email, 2592000, JSON.stringify({
            bankName: user.bankName,
            accountNumber: user.accountNumber,
            accountName: user.accountName,
            reason,
            amount,
            date: new Date().toISOString()
          }));

          await this.deleteTransferRecipient(recipientCode); // Delete recipient after failed transfer

          logger.warn(`[${this.context}] ${reason}: Retries exhausted. Transfer has been marked and stored as a failed transfer.\n`);
          return;
        }
      };

      // Initiate first retry attempt and store the retry key to track the number of retries
      await this.initiateTransfer(recipientCode, amount, reason, metadata);
      await redis.setEx(retryKey, 86400, JSON.stringify({ retries: 1 }));

      logger.info(`[${this.context}] ${reason}: Transfer retry to ${user.email} initiated.\n`);
      return;
    } catch (error) {
      logger.error(`[${this.context}] ${reason}: An error occurred while processing transfer retry. Error: ${error.message}\n`);
      throw error;
    } finally {
      await redis.disconnect();
    }
  }

  async initializeTransaction(email: string, amount: number, metadata: Record<string, any>)
    : Promise<string> {
    try {
      const url = 'https://api.paystack.co/transaction/initialize'
      const transaction = await axios.post(url,
        { amount, email, metadata },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Secrets.PAYSTACK_SECRET_KEY}`
          }
        }
      )

      return transaction.data.data.authorization_url
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while initializing transaction. Error: ${error.message}\n`);
      throw error;
    }
  }
}
