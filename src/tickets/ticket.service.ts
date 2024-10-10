import { randomUUID } from "crypto";
import mongoose from "mongoose";
import qrcode from "qrcode";

import { Event } from "../events/event.model";
import { Ticket } from "./ticket.model";
import { User } from "../users/user.model";
import { initiateTransfer } from "../shared/util/paystack";
import { ticketPurchaseMail, sendEmail } from "../shared/util/mail";

export const generateBarcode = (accessKey: string) => {
  let barcode: string;

  qrcode.toDataURL(accessKey, (err, imageUrl) => {
    if (err) {
      console.log('An error occured', err)
    }

    console.log('Barcode image saved successfully')
    barcode = imageUrl;
  })

  return barcode;
}

export const purchaseTicket = async (eventId: string, tier: string, quantity: number, userId: string) => {
  const event = await Event.findById(eventId)
  const user = await User.findById(userId)
  let amount: number;

  // Check if the user is restricted by age from attending the event
  if (user.age > event.ageRestriction) {
    for (const ticket of event.tickets) {
      // Find the ticket tier and check if the number of tickets left for that tier is greater than or equal to the purchase quantity
      if (ticket.tier === tier && ticket.totalNumber >= quantity) {
        // Check if a discount is available
        if (ticket.discount) {
          const currentTime = new Date().getTime()
          const expirationDate = new Date(ticket.discount.expirationDate).getTime()
          // Check if the discount has expired and if the discount tickets left is greater than or equal to the purchase quantity
          if (currentTime < expirationDate && ticket.discount.numberOfTickets >= quantity) {
            amount = ticket.discount.price * quantity // Calculate the ticket purchase amount using the discount price
            ticket.discount.numberOfTickets -= quantity // Subtract purchase quantity from number of discount tickets left
            ticket.totalNumber -= quantity // Also subtract purchase quantity from total number of tickets left
            await event.save()
  
            return { amount, discount: true }
          }
        } else {
          amount = ticket.price * quantity // Calculate the ticket purchase amount using the original price
          ticket.totalNumber -= quantity // Subtract purchase quantity from total number of tickets left
          await event.save()
  
          return { amount }
        }
      } else {
        return { insufficient: true }
      }
    }
  } else {
    return { restricted: true }
  }
}

export const completeTicketPurchase = async (metadata: Record<string, any>) => {
  const { userId, eventId, tier, quantity, amount } = metadata
  const price = amount / quantity

  const event = await Event.findById(eventId)
  const attendee = await User.findById(userId)

  const ticket = event.tickets.find(ticket => ticket.tier === tier)
  // Check the number of discount tickets left and update status of the discount offer
  if (ticket.discount.numberOfTickets === 0) { ticket.discount.status = 'ended' }
  // Check the total number of tickets left and update status of the ticket tier
  if (ticket.totalNumber === 0) { ticket.soldOut = true }

  const split = amount * 0.9 // Subtract the platform fee (10%) from transaction amount and calculate the organizer's split
  
  // Initiate transfer of the organizer's split
  const transferMetadata = { userId: event.user.toString(), eventId }
  // await initiateTransfer(event.organizer.recipient, split * 100, 'Revenue Split', transferMetadata)
  
  event.revenue += split // Add the organizer's split to the event's total revenue
  event.attendees.push(new mongoose.Types.ObjectId(userId as string)) // Add the user to the attendee list

  await event.save() // Save all changes

  const accessKey = randomUUID().split('-')[4]
  const barcode = generateBarcode(accessKey)

  // Create the required number of tickets
  for (let i = 1; i <= quantity; i++) {
    const ticket = await Ticket.create({
      attendee: userId,
      event: eventId,
      tier,
      price,
      accessKey,
    })
    await ticket.save()
  }
  
  // Send an email with the ticket PDFs to the attendee
  const subject = 'Ticket Purchase'
  const emailContent = ticketPurchaseMail({ attendee, event, tier, quantity, amount, accessKey, barcode })
  await sendEmail(attendee, subject, emailContent)
}

export const checkDiscountExpiration = async () => {
  const events = await Event.find()

  for (let event of events) {
    event.tickets.forEach(ticket => {      
      if (ticket.discount) {
        const currentTime = new Date().getTime()
        const expirationDate = new Date(ticket.discount.expirationDate).getTime()

        if (currentTime > expirationDate) { ticket.discount.status = 'ended' }
      }
    })

    await event.save()
  }
}

export const validateTicket = async (eventId: string, text: string) => {
  const tickets = await Ticket.find({ event: eventId })
  const ticket = tickets.find(ticket => ticket.accessKey === text)

  if (ticket) {
    if (ticket.status === 'used') {
      return { used: true }
    }

    ticket.status = 'used'
    await ticket.save()

    return { validated: true }
  }

  return { invalid: true };
}