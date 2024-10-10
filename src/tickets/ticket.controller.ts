import { Request, Response } from 'express';
import { Types } from 'mongoose';

import { initializeTransaction } from '../shared/util/paystack';
import { getUserById } from '../users/user.service';
import * as Ticket from '../tickets/ticket.service'
import { getEventById } from '../events/event.service';

export const purchaseTicket = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id parameter" }).end()
    }
    const { tier, quantity } = req.body
    const { redirectURL } = req.query

    // Get the id and email of the logged in user
    const userId = req.session.user.id
    const email = (await getUserById(userId)).email

    const { amount, discount, insufficient, restricted } = await Ticket.purchaseTicket(eventId, tier, +quantity, userId)
    const metadata = {
      userId,
      eventId,
      tier,
      amount,
      discount,
      quantity: +quantity,
      cancel_action: redirectURL as string
    }

    // Return an error message if the purchase quantity is more than the available tickets
    if (insufficient) {
      return res.status(400).json({ error: `Insufficient ${tier} tickets. Check out other ticket tiers` }).end()
    }

    // Return an error message if the user is restricted by age from purchasing the tickets
    const ageRestriction = (await getEventById(eventId)).ageRestriction
    if (restricted) {
      return res.status(400).json({ error: `You must be at least ${ageRestriction} years old to attend this event` }).end()
    }

    const checkoutURL = await initializeTransaction(email, amount * 100, metadata) // Initialize ticket purchase

    return res.status(200).json({ checkoutURL }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const validateTicket = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id parameter" })
    }

    const { invalid, used, validated } = await Ticket.validateTicket(eventId, req.body.accessKey)
    if (invalid) {
      return res.status(400).json({ error: 'Invalid barcode or access key' }).end()
    } else if (used) {
      return res.status(400).json({ error: 'This ticket has already been used' }).end()
    } else if (validated) {
      return res.status(200).json({ message: 'Ticket validated successfully' }).end()
    }
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}