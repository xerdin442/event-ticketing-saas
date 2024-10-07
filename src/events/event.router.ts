import express from 'express';

import * as Event from './event.controller';
import { isEventOwner, isLoggedIn } from '../shared/middlewares/authorization';
import { upload } from '../shared/config/storage';

export default (router: express.Router) => {
  router.post('/events/create', upload('event-ticketing').single('poster'), isLoggedIn, Event.createEvent)
  router.get('/events/:eventId', isLoggedIn, Event.getEventDetails)
  router.post('/events/:eventId/add-ticket', isLoggedIn, isEventOwner, Event.addTicketTier)
  router.put('/events/:eventId/update', upload('event-ticketing').single('poster'), isLoggedIn, isEventOwner, Event.updateEventDetails)
  router.post('/events/:eventId/cancel', isLoggedIn, isEventOwner, Event.cancelEvent)
  router.get('/events/nearby', isLoggedIn, Event.nearbyEvents)
  router.get('/events/filter', isLoggedIn, Event.filterEventsByCategory)
};