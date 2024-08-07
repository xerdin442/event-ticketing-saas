import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  age: string
  username: string
  email: string
  profileImage: string
  password: string
  role: string
  resetToken?: number,
  resetTokenExpiration?: number
}

const userSchema = new Schema<IUser>({
  age: { type: String, required: true },
  username: { type: String, required: true },
  email: { type: String, required: true },
  profileImage: { type: String, required: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['Attendee', 'Organizer'],
    required: true,
  },
  resetToken: { type: Number },
  resetTokenExpiration: { type: Number }
})

export const User = mongoose.model<IUser>('User', userSchema);