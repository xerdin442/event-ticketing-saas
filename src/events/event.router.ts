import express from 'express';

import * as Event from './event.controller';
import { isLoggedIn } from '../shared/middlewares/authorization';
import { upload } from '../shared/config/storage';

const multipleUpload = upload('event-ticketing').fields([
  { name: 'poster', maxCount: 1 },
  { name: 'photos', maxCount: 6 },
  { name: 'videos', maxCount: 3 },
])

export default (router: express.Router) => {
  router.post('/events/create', multipleUpload, isLoggedIn, Event.createEvent)
};