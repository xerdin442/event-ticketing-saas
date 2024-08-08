import { Response } from 'express';

import * as Event from './event.service'

export const createEvent = async (req: Event.MulterRequest, res: Response) => {
  try {
    // Extract all necessary fields from the request body
    const { organizerName, accountName, accountNumber, bank } = req.body
    const { eventName, description, category, date, ageRestriction } = req.body
    const { startTime, endTime, venueName, capacity, address } = req.body
    const { tickets, email, phone, whatsapp, twitter } = req.body
    
    const user = req.session.user.id // Get the id of the logged in user
    
    // Extract the path for all the uploaded files
    const poster = req.files.poster.path
    const photos = req.files.photos.map(file => file.path)
    const videos = req.files.videos.map(file => file.path)

    const event = await Event.createEvent({
      user,
      organizer: { name: organizerName, accountName, accountNumber, bank },
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
        location: { type: 'Point', coordinates: [] }
      },
      tickets,
      contact: { email, phone, whatsapp, twitter }
    })

    if (event) {}

    return res.status(201).json({ message: 'Event created successfully', event }).end()
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
}