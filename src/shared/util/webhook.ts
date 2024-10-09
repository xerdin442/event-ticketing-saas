import express, { Request, Response } from 'express';
import crypto from 'crypto';

import { User } from '../../users/user.model';
import { deleteTransferRecipient } from './paystack';
import { Event } from '../../events/event.model';
import { clients } from '../../index';
import { completeTicketPurchase } from '../../tickets/ticket.service';
import { sendEmail, ticketRefundMail } from './mail';

// Load environment variable as string
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string

async function pasytackCallback(req: Request, res: Response) {
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body)).digest('hex')

  if (hash === req.headers['x-paystack-signature']) {
    res.sendStatus(200) // Send a 200 OK response to Paystack server
    
    const { event } = req.body
    let data: Record<string, any>;
    
    if (event.includes('transfer')) {
      data = req.body.data.recipient
    } else if (event.includes('charge')) {
      data = req.body.data
    }

    console.log(data)
    const { userId, eventId, discount, tier, quantity } = data.metadata
    const user = await User.findById(userId)

    // Listen for status of transfers for ticket refunds and revenue splits
    if (event === 'transfer.success') {
      if (data.reason === 'Ticket Refund') {
        // Remove the attendee as a transfer recipient after the refund is complete
        await deleteTransferRecipient(data.recipient.recipient_code)
        
        // Notify the attendee of the ticket refund
        const event = await Event.findById(eventId)
        const emailContent = ticketRefundMail(user, event)
        await sendEmail(user, data.reason, emailContent, null)
      }

      console.log(`${data.reason}: Transfer to ${user.fullname} was successful!`)
      return true;
    } else if (event === 'transfer.failed') {
      console.log(`${data.reason}: Transfer to ${user.fullname} failed.`)
      // ***Retry transfer

      return true;
    } else if (event === 'transfer.reversed') {
      console.log(`${data.reason}: Transfer to ${user.fullname} has been reversed.`)
      // ***Retry transfer

      return true;
    }

    // Listen for status of transactions for ticket purchases
    if (event === 'charge.success') {
      // Emit a success message to the frontend WebSocket connection
      if (clients[userId]) {
        clients[userId].send(JSON.stringify({ status: 'success', message: 'Payment successful!' }));
      }

      await completeTicketPurchase(data.recipient.metadata)

      return true;
    } else if (event === 'charge.failed') {
      // Emit a failure message to the frontend WebSocket connection
      if (clients[userId]) {
        clients[userId].send(JSON.stringify({ status: 'failed', message: 'Payment failed!' }));
      }

      // Update number of tickets after failed ticket purchase
      const event = await Event.findById(eventId)
      const ticket = event.tickets.find(ticket => ticket.tier === tier)

      if (discount) { ticket.discount.numberOfTickets += quantity }
      ticket.totalNumber += quantity
      await event.save()

      return true;
    }
  }

  return res.status(400).send('Invalid signature')
}


export default (router: express.Router) => {
  router.post('/paystack/callback', pasytackCallback)
}