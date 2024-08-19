import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEvent extends Document {
  user: Types.ObjectId
  organizer: { name: string, accountName: string, accountNumber: string, bankName: string, recipient: string }
  title: string
  category: 'Tech' | 'Health' | 'Entertainment' | 'Fashion' | 'Sports' | 'Business' | 'Conference' |'Others'
  description: string
  date: Date
  ageRestriction?: string;
  media: { poster: string, photos: string[], videos: string[] };
  time: { start: string, end: string };
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  venue: {
    name: string
    capacity: number
    address: string
    location: { type: string, coordinates: number[] }
  };
  attendees: Types.ObjectId[]
  tickets: [{
    tier: string
    price: number
    discount?: { price: number, expirationDate: number, numberOfTickets: number }
    benefits?: string
    totalNumber: number
    soldOut: boolean
  }];
  shares: number
  revenue: number
  contact: { email: string, phone: string, whatsapp?: string, twitter?: string, instagram?: string, website?: string };
}

const eventSchema = new Schema<IEvent>({
  user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  organizer: {
    name: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankName: { type: String, required: true },
    recipient: { type: String } 
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  ageRestriction: { type: String },

  category: {
    type: String,
    enum: ['Tech', 'Health', 'Entertainment', 'Fashion', 'Sports', 'Business', 'Conference', 'Others'],
    required: true,
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
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    required: true,
    default: 'upcoming'
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

  attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],

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

  shares: { type: Number, required: true, default: 0 },
  revenue: { type: Number, required: true, default: 0 },

  contact: {
    email: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String },
    twitter: { type: String },
    instagram: { type: String },
    website: { type: String }
  }
})

// Add a 2dsphere index on location property for geospatial queires
eventSchema.index({ location: '2dsphere' });
// Add text index on 'name' and 'description' properties for full-text search capabilities
eventSchema.index({ name: 'text', description: 'text' });

export const Event = mongoose.model<IEvent>('Event', eventSchema);