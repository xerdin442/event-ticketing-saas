import express from 'express';

import user from './user'
import auth from './auth';

const router = express.Router()

export default (): express.Router => {
  user(router)
  auth(router)
  
  return router;
}