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
} from '../shared/middlewares/validator';

export default (router: express.Router) => {
  router.post('/register', upload('project-manager').single('profileImage'), validateSignUp, handleValidationErrors, User.register);
  router.post('/login', validateLogin, handleValidationErrors, User.login);
  router.post('/logout', isLoggedIn, User.logout);
  router.post('/reset', User.resetPassword)
  router.post('/confirm-reset', User.checkResetToken)
  router.post('/resend-token', User.resendToken)
  router.post('/change-password', validatePasswordReset, handleValidationErrors, User.changePassword)
  router.get('/users/:userId/profile', isLoggedIn, User.getProfile)
  router.put('/users/:userId/update-profile', upload('project-manager').single('profileImage'), isLoggedIn, validateUpdateProfile, handleValidationErrors, User.updateProfile)
  router.delete('/users/:userId/delete-account', isLoggedIn, User.deleteUser)
};