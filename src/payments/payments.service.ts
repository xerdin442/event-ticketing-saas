import { BadRequestException, Injectable } from '@nestjs/common';
import axios from "axios";
import { AccountDetails, BankData } from '../common/types';
import { Secrets } from '../common/env';
import logger from '../common/logger';

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
