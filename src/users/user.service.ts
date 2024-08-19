import { IUser, User } from './user.model';

export const getUserById = async (id: string) => {
  const user = await User.findById(id)
  if (!user) {
    throw new Error('An error occured while fetching user by id')
  }

  return user;
}

export const getUserByEmail = (email: string) => {
  return User.findOne({ email });
}

export const populateUser = async (user: IUser) => {
  const populatedUser = await User.findById(user._id)
    .populate({ path: 'cart.items.event', select: 'title' }).exec()

  return populatedUser;
}

export const createUser = async (values: Record<string, any>) => {
  const user = new User(values)
  if (!user) {
    throw new Error('An error occured while creating new user')
  }
  await user.save();

  return user.toObject();
}

export const updateProfile = async (id: string, values: Record<string, any>) => {
  const user = await User.findByIdAndUpdate(id, values, { new: true })
  return await populateUser(user)
}

export const deleteUser = (id: string) => {
  return User.deleteOne({ _id: id });
}

export const checkResetToken = async (resetToken: string) => {
  const token = Number(resetToken)
  return User.findOne({ resetToken: token }).select('+password')
}