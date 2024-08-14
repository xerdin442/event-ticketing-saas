import { Request, Response } from 'express';

import * as Event from './event.service'
import { MulterRequest } from "../shared/util/declarations";

export const createEvent = async (req: MulterRequest, res: Response) => {
  try {
    // Extract all necessary fields from the request body
    const { organizerName, accountName, accountNumber, bankName } = req.body
    const { title, description, category, date, ageRestriction } = req.body
    const { startTime, endTime, venueName, capacity, address } = req.body
    const { tickets, email, phone, whatsapp, twitter, instagram, website } = req.body
    
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
      title,
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
        location: { type: 'Point', coordinates: coordinates as number[] }
      },
      tickets,
      contact: { email, phone, whatsapp, twitter, instagram, website }
    })

    // If the event is created successfully, create a new transfer recipient with the organizer's bank details
    if (event) {      
      Event.createTransferRecipient({ accountName, accountNumber, bankName }, res)
    }

    return res.status(201).json({ message: 'Event created successfully', event }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const addDiscount = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    const { tier } = req.query
    const { price, expirationDate, numberOfTickets } = req.body

    await Event.addDiscount(eventId, tier as string, { price, expirationDate, numberOfTickets })

    return res.status(200).json({ message: `Discount offer added for ${tier} tickets.` })
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const updateEventDetails = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    const { date, startTime, endTime, venueName, capacity, address } = req.body

    // Generate coordinates from the updated address
    const coordinates = await Event.getCoordinates(address, res)

    const event = await Event.updateEventDetails(eventId, {
      date,
      time: { start: startTime, end: endTime },
      venue: {
        name: venueName,
        capacity,
        address,
        location: { type: 'Point', coordinates: coordinates as number[] }
      }
    })

    return res.status(200).json({ message: 'EVent details updated successfully', event })
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}