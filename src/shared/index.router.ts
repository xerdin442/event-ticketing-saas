import express from 'express';

import user from '../users/user.router'
import event from '../events/event.router'
import webhook from './util/webhook';

const router = express.Router()

export default (): express.Router => {
  user(router)
  event(router)
  webhook(router)
  
  return router;
}