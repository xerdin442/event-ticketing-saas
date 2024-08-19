import express, { Request, Response } from 'express';
import crypto from 'crypto';

import { User } from '../../users/user.model';
import { deleteTransferRecipient } from './paystack';
import { Event } from '../../events/event.model';

// Load environment variable as string
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string

// Webhook URL to listen for status of transactions and transfers on Paystack
async function pasytackCallback(req: Request, res: Response) {
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body)).digest('hex')

  if (hash === req.headers['x-paystack-signature']) {
    const { event, data } = req.body
    const { id } = data.recipient.metadata

    const user = await User.findById(id)

    if (event === 'transfer.success') {
      if (data.reason === 'Ticket Refund') {
        // Remove the attendee as a transfer recipient after the refund is complete
        await deleteTransferRecipient(data.recipient.recipient_code)
        
        // ***Send email to attendee
      }

      if (data.reason === 'Revenue Split') {
        // ***Send email to organizer 
      }
    } else if (event === 'transfer.failed') {
      // ***Repeat transfer
      console.log(`${data.reason}: Transfer to ${user.fullname} failed.`)
    }

    // ***Handle transactions for ticket purchases
  }

  return res.status(400).send('Invalid signature')
}


export default (router: express.Router) => {
  router.post('paystack/callback', pasytackCallback)
}