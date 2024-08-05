import express from 'express';

import * as User from '../controllers/user';
import { isLoggedIn, isProjectMember } from '../middlewares/authorization';
import { upload } from '../config/storage';
import { handleValidationErrors, validateUpdateProfile } from '../middlewares/validator';

export default (router: express.Router) => {
  router.get('/users', User.getAll);
  router.get('/users/:userId/profile', isLoggedIn, User.getProfile)
  router.put('/users/:userId/update-profile', upload('project-manager').single('profileImage'), isLoggedIn, validateUpdateProfile, handleValidationErrors, User.updateProfile)
  router.delete('/users/:userId/delete-account', isLoggedIn, User.deleteUser)
};
