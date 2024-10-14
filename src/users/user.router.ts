import express from 'express';

import * as User from './user.controller';
import { isLoggedIn } from '../shared/middlewares/authorization';
import { upload } from '../shared/config/storage';
import {
  handleValidationErrors,
  validateUpdateProfile,
  validateLogin,
  validatePasswordReset,
  validateSignUp
} from '../shared/middlewares/validation';

export default (router: express.Router) => {
  // Local authentication
  router.post('/auth/register', upload('event-ticketing').single('profileImage'), validateSignUp, handleValidationErrors, User.register);
  router.post('/auth/login', validateLogin, handleValidationErrors, User.login);
  router.post('/auth/logout', isLoggedIn, User.logout);
  router.post('/auth/reset', User.resetPassword)
  router.post('/auth/confirm-reset', User.checkResetToken)
  router.post('/auth/resend-token', User.resendToken)
  router.post('/auth/change-password', validatePasswordReset, handleValidationErrors, User.changePassword)

  // Profile
  router.get('/profile', isLoggedIn, User.getProfile)
  router.put('/profile/update', upload('event-ticketing').single('profileImage'), isLoggedIn, validateUpdateProfile, handleValidationErrors, User.updateProfile)
  router.delete('/profile/delete', isLoggedIn, User.deleteAccount)

  // Events and tickets
  router.get('/user/tickets', isLoggedIn, User.getAllTickets)
  router.get('/user/events', isLoggedIn, User.getAllEvents)
};