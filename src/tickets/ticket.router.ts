import express from 'express';

import * as Ticket from './ticket.controller';
import { isEventOwner, isLoggedIn, validateRole } from '../shared/middlewares/authorization';

export default (router: express.Router) => {
  router.post('events/:eventId/tickets/purchase', isLoggedIn, Ticket.purchaseTicket)
  router.post('events/:eventId/tickets/validate', isLoggedIn, validateRole('Organizer'), isEventOwner, Ticket.validateTicket)
}