import { Response } from 'express';

import * as Event from './event.service'
import { MulterRequest } from "../shared/util/declarations";

export const createEvent = async (req: MulterRequest, res: Response) => {
  try {
    // Extract all necessary fields from the request body
    const { organizerName, accountName, accountNumber, bankName } = req.body
    const { eventName, description, category, date, ageRestriction } = req.body
    const { startTime, endTime, venueName, capacity, address } = req.body
    const { tickets, email, phone, whatsapp, twitter } = req.body
    
    const user = req.session.user.id // Get the id of the logged in user
    
    // Extract the path of all the uploaded files
    const poster = req.files.poster.path
    const photos = req.files.photos.map(file => file.path)
    const videos = req.files.videos.map(file => file.path)

    // Generate coordinates from address
    const coordinates = await Event.getCoordinates(address, res)

    // Create a new event
    const event = await Event.createEvent({
      user,
      organizer: { name: organizerName, accountName, accountNumber, bank: bankName },
      name: eventName,
      category,
      description,
      date,
      ageRestriction,
      time: { start: startTime, end: endTime },
      media: { poster, photos, videos },
      venue: {
        name: venueName,
        capacity,
        address,
        location: { type: 'Point', coordinates }
      },
      tickets,
      contact: { email, phone, whatsapp, twitter }
    })

    // If the event is created successfully, create a new transfer recipient with the organizer's bank details
    if (event) {
      Event.createTransferRecipient({ accountName, accountNumber, bankName }, res)
    }

    return res.status(201).json({ message: 'Event created successfully', event }).end()
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
}