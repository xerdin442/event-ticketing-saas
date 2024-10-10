import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITicket extends Document {
  attendee: Types.ObjectId
  event: Types.ObjectId
  tier: string
  price: number
  status: 'active' | 'used' | 'cancelled'
  accessKey: string
}

const ticketSchema = new Schema<ITicket>({
  attendee: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  event: { type: Schema.Types.ObjectId, required: true, ref: 'Event' },
  tier: { type: String, required: true },
  price: { type: Number, required: true },
  status: {
    type: String,
    enum: ['active', 'used', 'cancelled'],
    required: true,
    default: 'active'
  },
  accessKey: { type: String, required: true },
}, {
  timestamps: { createdAt: 'orderDate', updatedAt: false }
})

export const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);