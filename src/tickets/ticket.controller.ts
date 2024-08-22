import { Request, Response } from 'express';
import { Types } from 'mongoose';

import { initializeTransaction } from '../shared/util/paystack';
import { getUserById } from '../users/user.service';
import * as Ticket from '../tickets/ticket.service'

export const purchaseTicket = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id parameter" })
    }
    const { tier, quantity } = req.body
    const { redirectURL } = req.query

    // Get the id and email of the logged in user
    const userId = req.session.user.id
    const email = (await getUserById(userId)).email

    const { amount, discount, insufficient } = await Ticket.purchaseTicket(eventId, tier, +quantity)
    const metadata = {
      userId,
      eventId,
      tier,
      quantity: +quantity,
      discount,
      cancel_action: redirectURL as string
    }

    // Return an error message if the purchase quantity is more than the available tickets
    if (insufficient) {
      return res.status(400).json({ error: `Insufficient ${tier} tickets. Check out other ticket tiers` })
    }

    // Initialize transaction and listen for the status on the webhook URL
    await initializeTransaction(email, amount, metadata)

    return res.sendStatus(200).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}