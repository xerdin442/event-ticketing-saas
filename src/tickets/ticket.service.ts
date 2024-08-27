import { randomUUID } from "crypto";
import mongoose from "mongoose";
import bwipjs from 'bwip-js'

import { Event } from "../events/event.model";
import { Ticket } from "./ticket.model";
import { User } from "../users/user.model";
import { initiateTransfer } from "../shared/util/paystack";
import { emailAttachment } from "../shared/util/declarations";

export const generateBarcode = async (accessKey: string) => {
  const barcodeImage = await bwipjs.toBuffer({
    bcid: 'code128',
    text: accessKey,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
  })

  return barcodeImage.toString('base64');
}

export const purchaseTicket = async (eventId: string, tier: string, quantity: number) => {
  const event = await Event.findById(eventId)
  let amount: number;

  for (const ticket of event.tickets) {
    // Find the ticket tier and check if the number of tickets left is greater than or equal to the purchase quantity
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
}

export const completeTicketPurchase = async (metadata: Record<string, any>) => {
  const { userId, eventId, tier, quantity, amount } = metadata
  const price = amount / quantity

  const event = await Event.findById(eventId)
  const attendee = await User.findById(userId)
  const organizer = await User.findById(event.user.toString())

  const ticket = event.tickets.find(ticket => ticket.tier === tier)
  // Check the number of discount tickets left and update status of the discount offer
  if (ticket.discount.numberOfTickets === 0) { ticket.discount.status = 'ended' }
  // Check the total number of tickets left and update status of the ticket tier
  if (ticket.totalNumber === 0) { ticket.soldOut = true }

  const recipient = event.organizer.recipient
  const split = amount * 0.9 // Subtract the platform fee (10%) from transaction amount and calculate organizer's split
  await initiateTransfer(recipient, split, 'Revenue Split', organizer._id.toString()) // Initiate transfer of organizer's split
  
  event.revenue = split // Add organizer's split to the event's total revenue
  event.attendees.push(new mongoose.Types.ObjectId(userId as string)) // Add the user to the attendee list

  await event.save() // Save all changes

  let ticketPDFs: emailAttachment[];

  // Create the required number of tickets
  for (let i = 1; i <= quantity; i++) {
    const accessKey = `EVENT-${randomUUID().replace(/-/g, '')}`
    const barcode = await generateBarcode(accessKey)

    // ***Generate and upload ticket pdf to cloudinary and add to pdf array
    
    const ticket = await Ticket.create({
      attendee: userId,
      event: eventId,
      tier,
      price,
      accessKey,
      barcode,
      pdfDocument: ''
    })
    await ticket.save()
  }
  
  // ***Send ticket purchase email to attendee and organizer
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