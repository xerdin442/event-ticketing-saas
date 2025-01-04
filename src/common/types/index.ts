export type BankData = {
  id: number
  name: string
  slug: string
  code: string
  longcode: string
  gateway: string | null
  pay_with_bank: boolean
  supports_transfer: boolean
  active: boolean
  country: string
  currency: string
  type: string
  is_deleted: boolean
  createdAt: string
  updatedAt: string
}

export type AccountDetails = {
  accountName: string
  accountNumber: string
  bankName: string
}

export type SessionData = {
  email?: string
  otp?: string
  otpExpiration?: number
}

export type EmailAttachment = {
  name: string
  content: string
}

export type FailedTransfer = {
  email: string
  details: any
}