import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITicket extends Document {
  customer: Types.ObjectId
  event: Types.ObjectId
  category: string
  price: number
  accessKey: string
}

const ticketSchema = new Schema<ITicket>({
  customer: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  event: { type: Schema.Types.ObjectId, required: true, ref: 'Event' },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  accessKey: { type: String, required: true },
}, {
  timestamps: { createdAt: 'orderDate', updatedAt: false }
})

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);