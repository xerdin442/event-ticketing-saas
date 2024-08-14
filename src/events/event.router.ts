import express from 'express';

import * as Event from './event.controller';
import { isLoggedIn, validateRole } from '../shared/middlewares/authorization';
import { upload } from '../shared/config/storage';

const multipleUpload = upload('event-ticketing').fields([
  { name: 'poster', maxCount: 1 },
  { name: 'photos', maxCount: 6 },
  { name: 'videos', maxCount: 3 },
])

export default (router: express.Router) => {
  router.post('/events/create', multipleUpload, isLoggedIn, Event.createEvent)
  router.post('/events/:eventId/discount', isLoggedIn, validateRole('Organizer'), Event.addDiscount)
  router.put('/events/:eventId/update', isLoggedIn, validateRole('Organizer'), Event.updateEventDetails)
};