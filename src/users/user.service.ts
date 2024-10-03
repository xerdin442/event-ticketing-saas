import { User } from './user.model';
import { Event } from '../events/event.model';
import { Ticket } from '../tickets/ticket.model';

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

export const createUser = async (values: Record<string, any>) => {
  const user = new User(values)
  if (!user) {
    throw new Error('An error occured while creating new user')
  }
  await user.save();

  return user.toObject();
}

export const updateProfile = async (id: string, values: Record<string, any>) => {
  return await User.findByIdAndUpdate(id, values, { new: true })
}

export const deleteUser = (id: string) => {
  return User.deleteOne({ _id: id });
}

export const checkResetToken = async (resetToken: string) => {
  const token = Number(resetToken)
  return User.findOne({ resetToken: token }).select('+password')
}

export const getAllEvents = async (userId: string) => {
  const events = await Event.find({ user: userId })
  return events;
}

export const getAllTickets = async (userId: string) => {
  const tickets = await Ticket.find({ attendee: userId })
  return tickets;
}