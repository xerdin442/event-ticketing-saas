import { Request, Response } from 'express';
import { Types } from 'mongoose';

import * as Event from './event.service'
import { MulterRequest } from "../shared/util/declarations";
import { verifyAccountDetails } from '../shared/util/paystack';
import { getUserById } from '../users/user.service';

export const createEvent = async (req: MulterRequest, res: Response) => {
  try {
    // Extract all necessary fields from the request body
    const { organizerName, accountName, accountNumber, bankName } = req.body
    const { title, description, category, date, ageRestriction } = req.body
    const { startTime, endTime, venueName, capacity, address } = req.body
    const { tickets, email, phone, whatsapp, twitter, instagram, website } = req.body
        
    // Extract the path of all the uploaded files
    const poster = req.files.poster.path
    const photos = req.files.photos.map(file => file.path)
    const videos = req.files.videos.map(file => file.path)

    const user = req.session.user.id // Get the id of the logged in user
    const coordinates = await Event.getCoordinates(address) // Generate the coordinates of the address
    await verifyAccountDetails(req.body) // Verify the organizer's account details

    const event = await Event.createEvent({
      user,
      organizer: { name: organizerName, accountName, accountNumber, bankName },
      title,
      category: category.toLowercase(),
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

    return res.status(201).json({ message: 'Event created successfully', event }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const getEventDetails = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id parameter" })
    }
    
    const event = await Event.getEventById(eventId)

    return res.status(200).json({ event }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const addDiscount = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id parameter" }).end()
    }

    const { tier } = req.query
    if (!tier) {
      return res.status(400).json({ error: 'Invalid ticket tier provided' }).end()
    }

    await Event.addDiscount(eventId, tier as string, req.body)

    return res.status(200).json({ message: `Discount offer added for ${tier} tickets.` }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const updateEventDetails = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id parameter" })
    }
    const { date, startTime, endTime, venueName, capacity, address } = req.body
    
    const coordinates = await Event.getCoordinates(address) // Generate coordinates from the updated address
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

    return res.status(200).json({ message: 'Event details updated successfully', event }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const cancelEvent = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid project ID" })
    }

    await Event.cancelEvent(eventId)

    return res.status(200).json({ message: 'Event cancellation successful' }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const nearbyEvents = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude } = req.body
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude of the user is required to find nearby events' }).end()
    }
    if (!(+latitude) || !(+longitude)) {
      return res.status(400).json({ error: 'Invalid longitude and latitude values' }).end()
    }

    const events = await Event.findNearbyEvents(+longitude, +latitude)

    return res.status(200).json({ message: 'Nearby events found', events }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const filterEventsByCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.query
    const events = await Event.filterEventsByCategory(category as string)

    return res.status(200).json({ events }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}