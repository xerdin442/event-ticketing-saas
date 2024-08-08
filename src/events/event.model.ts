import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEvent extends Document {
  user: Types.ObjectId
  organizer: { name: string, accountName: string, accountNumber: string, bank: string }
  name: string
  category: 'Tech' | 'Health' | 'Entertainment' | 'Fashion' | 'Sports' | 'Business' | 'Conference' |'Others'
  description: string
  date: Date
  ageRestriction?: string;
  media: { poster: string, photos: string[], videos: string[] };
  time: { start: string, end: string };
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Cancelled';
  venue: {
    name: string
    capacity: number
    address: string
    location: { type: string, coordinates: number[] }
  };
  tickets: [{
    tier: string
    price: number
    discount?: { price: number, expirationDate: number, numberOfTickets: number }
    benefits?: string
    totalNumber: number
    soldOut: boolean
  }];
  contact: { email: string, phone: string, whatsapp?: string, twitter?: string };
}

const eventSchema = new Schema<IEvent>({
  user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  organizer: {
    name: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bank: { type: String, required: true },  
  },
  name: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  ageRestriction: { type: String },

  category: {
    type: String,
    enum: ['Tech', 'Health', 'Entertainment', 'Fashion', 'Sports', 'Business', 'Conference', 'Others'],
    required: true,
    default: 'Others'
  },
  
  media: {
    poster: { type: String, required: true },
    photos: [{ type: String, required: true }],
    videos: [{ type: String, required: true }]
  },
  
  time: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },

  status: {
    type: String,
    enum: ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'],
    required: true,
    default: 'Upcoming'
  },

  venue: {
    name: { type: String, required: true },
    capacity: { type: Number, required: true },
    address: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    }
  },

  tickets: [{
    tier: { type: String, required: true },
    price: { type: Number, required: true },
    discount: {
      price: { type: Number, required: true },
      expirationDate: { type: Number, required: true },
      numberOfTickets: { type: Number, required: true }
    },
    benefits: { type: String },
    totalNumber: { type: Number, required: true },
    soldOut: { type: Boolean, required: true, default: false }
  }],

  contact: {
    email: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String },
    twitter: { type: String }
  }
})

// Add a 2dsphere index on location property for geospatial queires
eventSchema.index({ location: '2dsphere' });
// Add text index on 'name' and 'description' properties for full-text search capabilities
eventSchema.index({ name: 'text', description: 'text' });

export const Event = mongoose.model<IEvent>('Event', eventSchema);