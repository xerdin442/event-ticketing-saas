import { Event } from "../models/event";

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