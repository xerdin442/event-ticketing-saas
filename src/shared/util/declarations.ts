import { Request } from "express"

export type MulterRequest = Request & {
  files: {
    poster?: Express.Multer.File
    photos?: Express.Multer.File[]
    videos?: Express.Multer.File[]
  }
}

export type paystackBankDetails = {
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