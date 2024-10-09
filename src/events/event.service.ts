import axios from "axios";

import { Event } from "./event.model";
import { User } from "../users/user.model";
import { Ticket } from "../tickets/ticket.model";
import { sendEmail, eventUpdateMail, eventCancellationMail, eventSoldOutMail } from "../shared/util/mail";
import * as Paystack from "../shared/util/paystack";

// Load the environment variables as strings
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY as string

export const createEvent = async (values: Record<string, any>) => {
  const event = new Event(values)
  if (!event) {
    throw new Error('An error occured while creating new event')
  }

  // Create a new transfer recipient with the organizer's bank details
  event.organizer.recipient = await Paystack.createTransferRecipient(event.organizer)
  await event.save();

  return event.toObject();
}

export const getEventById = async (id: string) => {
  const event = await Event.findById(id)
  if (!event) {
    throw new Error('An error occured while fetching user by id')
  }

  return event;
}

export const updateEventDetails = async (id: string, details: Record<string, any>) => {
  const event = await Event.findByIdAndUpdate(id, details, { new: true })
  await event.save()

  for (let attendee of event.attendees) {
    const receiver = await User.findById(attendee)
    const subject = 'Event Update'
    const emailContent = eventUpdateMail(receiver, event)

    // Notify the attendee of the event updates
    await sendEmail(receiver, subject, emailContent, null)
  }

  return event;
}

export const updateEventStatus = async () => {
  const events = await Event.find()

  for (let event of events) {
    const currentTime = new Date().getTime()
    const startTime = new Date(event.time.start).getTime()
    const endTime = new Date(event.time.end).getTime()

    if (currentTime > startTime && currentTime < endTime) {
      event.status = 'ongoing'
    } else if (currentTime > endTime) {
      event.status = 'completed'
      // Remove the organizer as a transfer recipient when the event is complete
      await Paystack.deleteTransferRecipient(event.organizer.recipient)
    } else if (event.tickets.every(ticket => ticket.soldOut === true)) {
      event.status = 'sold out'

      const receiver = await User.findById(event.user)
      const subject = 'SOLD OUT!'
      const emailContent = eventSoldOutMail(receiver, event)

      // Notify the event organizer that the event is sold out
      await sendEmail(receiver, subject, emailContent, null)
    }

    await event.save() // Save changes
  }
}

export const cancelEvent = async (eventId: string) => {
  // Update event status and reset revenue value
  const event = await Event.findByIdAndUpdate(eventId, 
    { status: 'cancelled', revenue: 0 }, { new: true })
  await event.save()

  for (let attendee of event.attendees) {
    const receiver = await User.findById(attendee)
    const subject = 'Event Cancellation'
    const emailContent = eventCancellationMail(receiver, event)

    // Notify the attendee of the event cancellation
    await sendEmail(receiver, subject, emailContent, null)

    // Update the status of the attendee's tickets for this event
    const tickets = await Ticket.find({ attendee, event: event._id })
    tickets.forEach(async (ticket) => {
      ticket.status = 'cancelled'
      await ticket.save()
    })

    // Create a transfer recipient for the attendee to receive the refund
    const recipientCode = await Paystack.createTransferRecipient(receiver.refundProfile)

    // Convert the amount to kobo and calculate the refund
    let refund: number = 0;
    tickets.forEach(ticket => refund += ticket.price * 100)

    // Initiate transfer of ticket refund and listen for response on the webhook URL
    const metadata = { userId: attendee.toString(), eventId }
    // await Paystack.initiateTransfer(recipientCode, refund, 'Ticket Refund', metadata)
  }
}

export const getCoordinates = async (address: string) => {
  // Encode the given address as a URL component
  const encodedAddress = address.replace(/,/g, '').replace(/\s/g, '+')
  const url = `https://geocode.maps.co/search?q=${encodedAddress}&api_key=${GEOCODING_API_KEY}`

  // Get the latitude and longitude from the address information returned by the Geocoding API
  const response = await axios.get(url)
  if (response.status === 200) {
    if (response.data[0] === undefined) {
      return { notFound: true }
    }

    const latitude = response.data[0].lat
    const longitude = response.data[0].lon

    return { latitude, longitude }
  }
}

export const addTicketTier = async (id: string, ticketDetails: Record<string, any>) => {
  const event = await Event.findById(id)
  const { tier, price, benefits, totalNumber, discountPrice, discountExpirationDate, numberOfDiscountTickets } = ticketDetails

  // Create a new ticket tier if the event is not sold out
  if (event.status !== 'sold out') {
    event.tickets.push({
      tier,
      price,
      benefits,
      totalNumber,
      soldOut: false
    })
    await event.save()

    // Add discount offer to the newly created ticket tier if discount details are defined
    if (discountPrice && discountExpirationDate && numberOfDiscountTickets) {
      const ticket = event.tickets.find(ticket => ticket.tier === tier)

      ticket.discount = {
        price: discountPrice,
        expirationDate: discountExpirationDate,
        numberOfTickets: numberOfDiscountTickets,
        status: 'active'
      }
      await event.save()
    }

    return { event }
  } else { 
    return { soldOut: true }
  }
}

export const findNearbyEvents = async (longitude: number, latitude: number) => {
  const events = await Event.find({
    venue: {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: 5000 // Find nearby events in venues located within 5km of the user
        }
      }
    }
  })

  return events;
}

export const filterEventsByCategory = async (category: string) => {
  const events = await Event.find({ category })
  return events;
}