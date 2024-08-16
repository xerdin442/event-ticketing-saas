import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  age: string
  fullname: string
  email: string
  profileImage: string
  password: string
  role: string
  cart: {
    items: [{ event: Types.ObjectId, tier: string, quantity: number }] | []
    total: number
  }
  resetToken?: number,
  resetTokenExpiration?: number
  refundProfile: { accountName: string, accountNumber: string, bankName: string }
}

const userSchema = new Schema<IUser>({
  age: { type: String, required: true },
  fullname: { type: String, required: true },
  email: { type: String, required: true },
  profileImage: { type: String, required: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['Attendee', 'Organizer'],
    required: true,
  },
  cart: {
    items: [{
      event: { type: Schema.Types.ObjectId, required: true },
      tier: { type: String, required: true },
      quantity: { type: Number, required: true },
    }],
    total: { type: Number, required: true, default: 0.00 },
  },
  resetToken: { type: Number },
  resetTokenExpiration: { type: Number },
  refundProfile: {
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankName: { type: String, required: true }
  }
})

export const User = mongoose.model<IUser>('User', userSchema);