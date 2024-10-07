import { Request, Response } from 'express';
import { Types } from 'mongoose';

import * as Event from './event.service'
import { verifyAccountDetails } from '../shared/util/paystack';

export const createEvent = async (req: Request, res: Response) => {
  try {
    // Extract all necessary fields from the request body
    const { organizerName, accountName, accountNumber, bankName } = req.body
    const { title, description, category, date, ageRestriction } = req.body
    const { startTime, endTime, venueName, capacity, address } = req.body
    const { email, phone, whatsapp, twitter, instagram, website } = req.body

    const user = req.session.user.id // Get the id of the logged in user
    await verifyAccountDetails(req.body) // Verify the organizer's account details

    // Generate the coordinates of the address
    const location = venueName + '+' + address
    const { notFound, latitude, longitude } = await Event.getCoordinates(location)
    if (notFound) {
      return res.status(400).json({ error: 'Failed to find address on the map and generate coordinates' })
    }

    const event = await Event.createEvent({
      user,
      organizer: { name: organizerName, accountName, accountNumber, bankName },
      title,
      category,
      description,
      date,
      ageRestriction,
      time: { start: startTime, end: endTime },
      poster: req.file.path,
      venue: {
        name: venueName,
        capacity,
        address,
        location: { type: 'Point', coordinates: [+latitude, +longitude] }
      },
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

export const addTicketTier = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: 'Invalid event id parameter' }).end()
    }

    const { event, soldOut } = await Event.addTicketTier(eventId, req.body)
    if (soldOut) {
      return res.status(400).json({ error: 'Ticket tiers cannot be added to a sold out event' })
    } else if (event) {
      return res.status(200).json({ message: 'Ticket tier added successfully', event }).end()
    }
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
    const { title, description, category, date, startTime, endTime, venueName, capacity, address } = req.body
    
    // Generate the coordinates from the updated address
    const location = venueName + '+' + address
    const { notFound, latitude, longitude } = await Event.getCoordinates(location)
    if (notFound) {
      return res.status(400).json({ error: 'Failed to find address on the map and generate coordinates' })
    }
    
    const event = await Event.updateEventDetails(eventId, {
      title,
      description,
      category,
      date,
      poster: req.file.path,
      time: { start: startTime, end: endTime },
      venue: {
        name: venueName,
        capacity,
        address,
        location: { type: 'Point', coordinates: [+latitude, +longitude] }
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