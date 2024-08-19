import { Response } from "express";
import axios from "axios";

import { paystackBankDetails } from "./declarations";

// Load the environment variables as strings
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string

export const getBankNames = async () => {
  const banksPerPage: number = 60
  const url = `https://api.paystack.co/bank?country=nigeria&perPage=${banksPerPage}`

  let bankNames: string[];
  const response = await axios.get(url)
  if (response.status === 200) {
    const banks = response.data.data
    bankNames = banks.map((bank: paystackBankDetails) => bank.name)
  } else {
    throw new Error('An error occured while fetching bank information')
  }

  return bankNames;
}

export const getBankCode = async (bankName: string) => {
  let recipientBank: paystackBankDetails;
  const banksPerPage: number = 60
  const url = `https://api.paystack.co/bank?country=nigeria&perPage=${banksPerPage}`

  const bankDetails = await axios.get(url)
  if (bankDetails.status === 200) {
    const banks = bankDetails.data.data
    recipientBank = banks.find((bank: paystackBankDetails) => bank.name === bankName)
  } else {
    throw new Error('An error occured while fetching bank information')
  }

  return recipientBank.code;
}

export const verifyAccountDetails = async (accountDetails: Record<string, any>, res: Response) => {
  const { accountName, accountNumber, bankName } = accountDetails
  const code = await getBankCode(bankName)

  // Check if the account details match and return an error message if there is a mismatch
  const url = `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${code}`
  const verification = await axios.get(url, {
    headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
  })

  if (verification.status === 200) {
    if (verification.data.data.account_name !== accountName) {
      return res.status(400).json({ error: "Failed to verify account details. Kindly input the correct account information" }).end()
    }
  } else {
    throw new Error('An error occured while verifiying account details')
  }
}

export const createTransferRecipient = async (accountDetails: Record<string, any>) => {
  const { accountName, accountNumber, bankName } = accountDetails
  const code = await getBankCode(bankName)

  // Create a new transfer recipient
  const url = 'https://api.paystack.co/transferrecipient'
  const recipient = await axios.post(url,
    {
      "type": "nuban",
      "bank_code": code,
      "name": accountName,
      "account_number": accountNumber,
      "currency": "NGN"
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    }
  )

  if (recipient.status !== 200) {
    throw new Error('An error occured while creating transfer recipient')
  }

  return recipient.data.data.recipient_code;
}

export const deleteTransferRecipient = async (code: string) => {
  const url = `https://api.paystack.co/transferrecipient/${code}`
  const deleteRecipient = await axios.delete(url, {
    headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` }
  })

  if (deleteRecipient.status !== 200) {
    throw new Error('An error occured while deleting transfer recipient')
  }
}

export const initiateTransfer = async (code: string, amount: number, reason: string, id: string) => {
  const url = 'https://api.paystack.co/transfer'
  const transfer = await axios.post(url,
    {
      "amount": amount,
      "reason": reason,
      "source": "balance",
      "recipient": code,
      "currency": "NGN",
      "metadata": { id }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    }
  )

  if (transfer.status !== 200) {
    throw new Error('An error occured while creating transfer recipient')
  }

  return transfer.data.data.transfer_code;
}