import { Event } from "../events/event.model";

export const purchaseTicket = async (eventId: string, tier: string, quantity: number) => {
  const event = await Event.findById(eventId)
  let amount: number = 0

  for (const ticket of event.tickets) {
    // Find the ticket tier and check if the number of tickets left is greater than or equal to the purchase quantity
    if (ticket.tier === tier && ticket.totalNumber >= quantity) {
      // Check if a discount is available
      if (ticket.discount) {
        const currentTime = new Date().getTime()
        // Check if the discount has expired and if the discount tickets left is greater than or equal to the purchase quantity
        if (currentTime < ticket.discount.expirationDate && ticket.discount.numberOfTickets >= quantity) {
          amount = ticket.discount.price * quantity // Calculate the ticket purchase amount using the discount price
          ticket.discount.numberOfTickets -= quantity // Subtract purchase quantity from number of discount tickets left
          ticket.totalNumber -= quantity // Also subtract purchase quantity from total number of tickets left
          await event.save()

          return { amount, discount: true }
        }
      } else {
        amount = ticket.price * quantity // Calculate the ticket purchase amount
        ticket.totalNumber -= quantity // Subtract purchase quantity from total number of tickets left
        await event.save()

        return { amount, discount: false }
      }
    } else {
      return { insufficient: true }
    }
  }
}