import { Response } from 'express';
import mongoose from 'mongoose';

import { User } from './user.model';

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

export const updateProfile = (id: string, values: Record<string, any>) => {
  return User.findByIdAndUpdate(id, values, { new: true })
}

export const deleteUser = (id: string) => {
  return User.deleteOne({ _id: id });
}

export const checkResetToken = async (resetToken: string) => {
  const token = Number(resetToken)
  return User.findOne({ resetToken: token }).select('+password')
}

export const getCart = async (id: string) => {
  const user = await getUserById(id)
  return user.cart;
}

export const clearCart = async (id: string) => {
  const user = await getUserById(id)
  user.cart.items = []
  await user.save()
}

export const addCartItem = async (eventId: string, userId: string, tier: string, res: Response) => {
  const user = await getUserById(userId)

  for (let item of user.cart.items) {
    if (item.event.equals(eventId) && item.tier === tier) {
      return res.status(400).json({ error: 'Ticket has already been added to cart' }).end()
    }
  }

  await User.findByIdAndUpdate(userId, {
    cart: {
      $push: {
        items: {
          event: new mongoose.Types.ObjectId(eventId),
          tier,
          quantity: 1
        }
      }
    }
  }, { new: true })
}

export const deleteCartItem = async (eventId: string, userId: string, tier: string) => {
  const user = await getUserById(userId)

  for (let item of user.cart.items) {
    if (item.event.equals(eventId) && item.tier === tier) {
      await User.findByIdAndUpdate(userId, {
        cart: { $pull: { items: { tier } } }
      }, { new: true })
    }
  }
}

export const incrementOrDecrementCartItem = async (eventId: string, userId: string, tier: string, action: string) => {
  const user = await getUserById(userId)

  for (let item of user.cart.items) {
    if (item.event.equals(eventId) && item.tier === tier) {
      if (action === 'increment') { item.quantity += 1 }
      if (action === 'decrement') { item.quantity -= 1 }
    }
  }

  await user.save()
}