import { PrismaClient } from "prisma/generated/client"

export interface BankData {
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

export interface AccountDetails {
  accountName: string
  accountNumber: string
  bankName: string
}

export type PaymentStatus = 'success' | 'failed' | 'refund';

export interface PasswordResetInfo {
  email: string
  otp: string
}

export interface TicketRefundInfo extends PasswordResetInfo {
  eventId: number,
  refundAmount: number;
}

export interface TicketLockInfo {
  status: "locked" | "paid";
  tierId: number;
  discount: boolean;
  numberOfTickets: number;
}

export interface TicketDetails {
  price: number;
  tier: string;
  eventId: number;
  attendee: string;
  discountPrice?: number
}

export interface PaystackCheckoutResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface WhatsappWebhookNotification {
  status: PaymentStatus;
  email: string;
  phoneId: string;
  reference: string;
  transactionRef: string;
  reason?: string;
}

export interface CloudinaryResource {
  asset_id: string
  public_id: string
  format: string
  version: number
  resource_type: string
  type: string
  created_at: string
  bytes: number
  width?: number
  height?: number
  asset_folder: string
  display_name: string
  url: string
  secure_url: string
  tags?: string[]
  next_cursor?: string
}

type ExcludedMethods = '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
export type CustomPrismaTxClient = Omit<PrismaClient, ExcludedMethods>