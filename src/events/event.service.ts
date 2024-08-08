import { Request } from "express";
import axios from "axios";

import { Event } from "./event.model";

export type MulterRequest = Request & {
  files: {
    poster?: Express.Multer.File
    photos?: Express.Multer.File[]
    videos?: Express.Multer.File[]
  }
}

export const getEventById = (id: string) => {
  return Event.findById(id)
}

export const createEvent = async (values: Record<string, any>) => {
  const event = new Event(values)
  if (!event) {
    throw new Error('An error occured while creating new event')
  }
  await event.save();
  
  return event.toObject();
}

export const updateDetails = (id: string, values: Record<string, any>) => {
  return Event.findByIdAndUpdate(id, values, { new: true })
}

export const deleteEvent = (id: string) => {
  return Event.deleteOne({ _id: id });
}

export const createRecipient = async (accountDetails: Record<string, any>) => {
  const sercetKey = process.env.PAYSTACK_SECRET_KEY as string
  
  const banksPerPage: number = 85
  const bankURL = `https://api.paystack.co/bank?country=nigeria&perPage=${banksPerPage}`
  const banks = await axios.get(bankURL, {
    headers: {
      'Authorization': `Bearer ${sercetKey}`,
    }
  })
}