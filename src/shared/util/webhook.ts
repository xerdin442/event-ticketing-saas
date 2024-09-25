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
    const { event, data } = req.body
    const { userId, eventId, discount, tier, quantity } = data.recipient.metadata

    const user = await User.findById(userId)

    // Listen for status of transfers for ticket refunds and revenue splits
    if (event === 'transfer.success') {
      res.sendStatus(200) // Send a 200 OK response to Paystack server

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
      res.sendStatus(200) // Send a 200 OK response to Paystack server

      console.log(`${data.reason}: Transfer to ${user.fullname} failed.`)
      // ***Retry transfer

      return true;
    } else if (event === 'transfer.reversed') {
      res.sendStatus(200) // Send a 200 OK response to Paystack server

      console.log(`${data.reason}: Transfer to ${user.fullname} has been reversed.`)
      // ***Retry transfer

      return true;
    }

    // Listen for status of transactions for ticket purchases
    if (event === 'charge.success') {
      res.sendStatus(200) // Send a 200 OK response to Paystack server
      
      await completeTicketPurchase(data.recipient.metadata)

      // Emit a success message to the user's WebSocket connection
      if (clients[userId]) {
        clients[userId].send(JSON.stringify({ status: 'success', message: 'Payment successful!' }));
      }

      return true;
    } else if (event === 'charge.failed') {
      res.sendStatus(200) // Send a 200 OK response to Paystack server

      // Update number of tickets after failed ticket purchase
      const event = await Event.findById(eventId)
      const ticket = event.tickets.find(ticket => ticket.tier === tier)

      if (discount) { ticket.discount.numberOfTickets += quantity }
      ticket.totalNumber += quantity
      await event.save()

      // Emit a failure message to the user's WebSocket connection
      if (clients[userId]) {
        clients[userId].send(JSON.stringify({ status: 'failed', message: 'Payment failed!' }));
      }

      return true;
    }
  }

  return res.status(400).send('Invalid signature')
}


export default (router: express.Router) => {
  router.post('paystack/callback', pasytackCallback)
}