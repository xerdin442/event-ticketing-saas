import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { Secrets } from "../../../src/common/env";
import { PaymentsService } from "../../../src/payments/payments.service";
import { AccountDetails } from "../../../src/common/types";

describe('Payment Service', () => {
  let paymentsService: PaymentsService;
  let recipientCode: string;

  const details: AccountDetails = {
    accountName: Secrets.ACCOUNT_NAME,
    accountNumber: Secrets.ACCOUNT_NUMBER,
    bankName: Secrets.BANK_NAME,
  };

  beforeAll(async () => {
    jest.useRealTimers();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    // Creating and initializing Nest application
    const app = moduleRef.createNestApplication();

    paymentsService = app.get(PaymentsService);
  });

  describe('Banks List', () => {
    it('should return a list of Paystack supported banks', async () => {
      await paymentsService.getBankNames();
    }, 30000);
  });

  describe('Bank Code', () => {
    it('should throw if bank name is invalid or not supported', async () => {
      await expect(paymentsService.getBankCode('Invalid bank name'))
        .rejects.toThrow('Bank not found. Kindly input the correct bank name');
    }, 30000);

    it('should return the Paystack code for the given bank', async () => {
      await paymentsService.getBankCode(details.bankName);
    }, 30000);
  });

  describe('Verify Account Details', () => {
    it('should throw if account number is invalid', async () => {
      await expect(paymentsService.verifyAccountDetails({
        ...details,
        accountNumber: '1234567890'
      }))
        .rejects.toThrow('Failed to verify account details. Please check your account number and try again');
    }, 30000);

    it('should throw if account name is wrong', async () => {
      await expect(paymentsService.verifyAccountDetails({
        ...details,
        accountName: 'Wrong Account Name'
      }))
        .rejects.toThrow('Please check the spelling or order of your account name. The names should be ordered as it was during your account opening at the bank');
    }, 30000);

    it('should throw if the order of the account name is incorrect', async () => {
      const name = Secrets.ACCOUNT_NAME.split(' ');
      await expect(paymentsService.verifyAccountDetails({
        ...details,
        accountName: `${name[2]} ${name[0]} ${name[1]}`
      }))
        .rejects.toThrow('Please check the spelling or order of your account name. The names should be ordered as it was during your account opening at the bank');
    }, 30000);

    it('should verify account details', async () => {
      await paymentsService.verifyAccountDetails(details)
    }, 30000)
  });

  describe('Create Transfer Recipient', () => {
    it('should create a new Pasytack transfer recipient', async () => {
      recipientCode = await paymentsService.createTransferRecipient(details);
    }, 30000);
  });

  describe('Delete Transfer Recipient', () => {
    it('should delete Pasytack transfer recipient by given code', async () => {
      await paymentsService.deleteTransferRecipient(recipientCode);
    }, 30000);
  });

  describe('Initialize Transaction', () => {
    it('should return a Paystack checkout link', async () => {
      await paymentsService.initializeTransaction(
        'payment@example.com',
        200000,
        { field: 'value '}
      );
    }, 30000);
  });
})