import mongoose, { Schema, Document, Types } from "mongoose";

export interface IEvent extends Document {
  user: Types.ObjectId
  organizer: string
  name: string
  category: 'Tech' | 'Health' | 'Entertainment' | 'Fashion' | 'Sports' | 'Business' | 'Conference' |'Others'
  description: string
  date: Date
  ageRestriction?: number;
  media: {
    poster: string
    photos: string[]
    videos: string[]
  };
  time: {
    start: string
    end: string
  };
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
    discount?: { amount: number, expirationDate: number }
    benefits?: string
    number: number
    soldOut: boolean
  }];
  sponsors: [{
    name: string;
    logo: string;
    website: string;
  }];  
  contact: { email: string, phone: number, whatsapp?: number, twitter?: string };
}

const eventSchema = new Schema<IEvent>({
  user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  organizer: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  ageRestriction: { type: Number },

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
      amount: { type: Number, required: true },
      expirationDate: { type: Number, required: true },  
    },
    benefits: { type: String },
    number: { type: Number, required: true },
    soldOut: { type: Boolean, required: true, default: false }
  }],

  sponsors: [{
    name: { type: String, required: true },
    logo: { type: String, required: true },
    website: { type: String, required: true },
  }],

  contact: {
    email: { type: String, required: true },
    phone: { type: Number, required: true },
    whatsapp: { type: Number },
    twitter: { type: String }
  }
})

export const Event = mongoose.model<IEvent>('Event', eventSchema);