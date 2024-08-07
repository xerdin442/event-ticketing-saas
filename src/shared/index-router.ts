import express from 'express';

import user from '../users/user.router'

const router = express.Router()

export default (): express.Router => {
  user(router)
  
  return router;
}