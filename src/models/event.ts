import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEvent extends Document {
  organizer: Types.ObjectId
  name: string
  flier: string
  description: string
  venue: Types.ObjectId
  date: Date
  time: string
  tickets: [{ category: string, price: number }]
  contact: { email: string, phone: number, whatsapp?: number }
}

const eventSchema = new Schema<IEvent>({
  organizer: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  flier: { type: String, required: true },
  description: { type: String, required: true },
  venue: { type: Schema.Types.ObjectId, required: true, ref: 'Venue' },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  tickets: [{
    category: { type: String, required: true },
    price: { type: Number, required: true },
  }],
  contact: {
    email: { type: String, required: true },
    phone: { type: Number, required: true },
    whatsapp: { type: Number },
  }
})

export const Event = mongoose.model<IEvent>('Event', eventSchema);