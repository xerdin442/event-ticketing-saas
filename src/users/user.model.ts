import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  age: number
  fullname: string
  email: string
  profileImage: string
  password: string
  resetToken?: number,
  resetTokenExpiration?: number
  refundProfile: { accountName: string, accountNumber: string, bankName: string }
}

const userSchema = new Schema<IUser>({
  age: { type: Number, required: true },
  fullname: { type: String, required: true },
  email: { type: String, required: true },
  profileImage: { type: String, required: true },
  password: { type: String, required: true, select: false },
  resetToken: { type: Number },
  resetTokenExpiration: { type: Number },
  refundProfile: {
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankName: { type: String, required: true }
  }
})

export const User = mongoose.model<IUser>('User', userSchema);