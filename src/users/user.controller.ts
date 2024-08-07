import { Request, Response } from 'express';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import * as User from './user.service';
import { sendEmail } from '../shared/util/mail'

export const register = async (req: Request, res: Response) => {
  try {
    // Extract required fields from request body
    let { age, username, email, password, profileImage, role } = req.body

    /* Use a default image if user does not upload file
    Or set profileImage to path of stored image if user uploads file */
    if (!req.file) {
      profileImage = process.env.DEFAULT_IMAGE
    } else {
      profileImage = req.file.path
    }

    // If all the checks are successful, create a new user
    const hashedPassword = await bcrypt.hash(password, 12)
    if (!hashedPassword) {
      return res.status(400).json({ error: "An error occured while hashing password" })
    }

    const user = await User.createUser({
      age,
      email,
      username,
      password: hashedPassword,
      profileImage,
      role
    })
    
    // Create and assign a JWT to expire in 3hrs
    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    )

    // Send a success message and authorization token if registration is complete
    return res.status(200).json({ message: 'Registration successful!', user: user, token }).end()
  } catch (error) {
    // Log and send an error message if any server errors are encountered
    console.log(error)
    return res.sendStatus(500)
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email } = req.body // Extract required fields from request body

    // If all checks are successful, configure session data for newly logged in user
    const user = await User.getUserByEmail(email)
    if (!user) {
      return res.status(400).json({ error: "An error occured while fetching user by email address" })
    }

    // Create and assign a JWT to expire in 3hrs
    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    )

    // Send a success message and authorization token if login is complete
    return res.status(200).json({ message: 'Login successful', token }).end()
  } catch (error) {
    // Log and send an error message if any server errors are encountered
    console.log(error)
    return res.sendStatus(500)
  }
}

export const logout = (req: Request, res: Response) => {
  // Delete and reset session data before logout
  req.session.destroy((err) => {
    if (err) {
      // Log and send an error message if any server errors are encountered
      console.log(err)
      return res.sendStatus(500)
    }

    return res.status(200).json({ message: 'You logged out' })
  })
}

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body // Extract email from request body
    const token = Math.ceil(Math.random() * 10 ** 6) // Generate reset token that will be sent to the user

    // Find user by email address and return an error if not found
    const user = await User.getUserByEmail(email)
    if (!user) {
      return res.status(400).json({ error: 'User with that email does not exist' })
    }
  
    // If user check is successful, set the token, expiration time and save changes
    user.resetToken = token
    user.resetTokenExpiration = Date.now() + (3 * 60 * 60 * 1000)
    await user.save()
  
    await sendEmail(user) // Send reset token to the user's email address
    req.session.email = user.email // Save user's email address in a session incase the user requests for the token to be re-sent
  
    console.log(token)
    // Notify user that password reset token has been sent
    return res.status(200).json({ message: 'A reset token has been sent to your email' }).end()
  } catch (error) {
    // Log and send an error message if any server errors are encountered
    console.log(error)
    return res.sendStatus(500)
  }
}

export const checkResetToken = async (req: Request, res: Response) => {
  try {
    const { resetToken } = req.body // Extract reset token from request body

    // Check if reset token is valid
    const user = await User.checkResetToken(resetToken)
    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' })
    }

    // Check if reset token has expired
    if (user.resetTokenExpiration < Date.now()) {
      return res.status(400).json({ error: 'The reset token has expired' })
    }

    // Reset token expiration time if the token is valid and save changes
    user.resetTokenExpiration = undefined
    await user.save()

    // Delete session created earlier for storing email and resending tokens
    req.session.destroy((err) => {
      if (err) { console.log(err) }
    })

    // Return redirect URL containing user's reset token
    const redirectURL = `https://project-manager-q6c3.onrender.com/api/auth/change-password?resetToken=${user.resetToken}`
    
    return res.status(200).json({ message: "Verification successful!", redirectURL })
  } catch (error) {
    // Log and send an error message if any server errors are encountered
    console.log(error)
    return res.sendStatus(500)
  }
}

export const resendToken = async (req: Request, res: Response) => {
  try {
    // Check if user exists with the email stored in session
    const user = await User.getUserByEmail(req.session.email)
    if (!user) {
      return res.status(400).json({ error: 'User not found' })
    }

    // Generate new reset token, reset the expiration time and save changes
    const token = Math.ceil(Math.random() * 10 ** 6)
    user.resetToken = token
    user.resetTokenExpiration = Date.now() + 120000
    await user.save()

    await sendEmail(user) // Send email with new reset token to user

    console.log(token)
    // Notify user that password reset token has been re-sent
    return res.status(200).json({ message: 'Another token has been sent to your email' })
  } catch (error) {
    // Log and send an error message if any server errors are encountered
    console.log(error)
    return res.sendStatus(500)
  }
}

export const changePassword = async (req: Request, res: Response) => {
  try {
    // Extract reset token from query paramters and new password from request body
    const { resetToken } = req.query
    const { password } = req.body

    // Send error message if reset token is invalid
    const user = await User.checkResetToken(resetToken as string)
    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' })
    }
  
    // Check if new passowrd matches previous password
    const checkMatch = await bcrypt.compare(password, user.password)
    if (checkMatch) {
      return res.status(400).json({ error: 'New password cannot be set to same value as previous password' })
    }

    // If reset token is valid, change password, reset the token value and save changes
    const hashedPassword = await bcrypt.hash(password, 12)
    if (!hashedPassword) {
      return res.status(400).json({ error: "An error occured while hashing password" })
    }
    
    user.password = hashedPassword
    user.resetToken = undefined
    await user.save()
  
    // Notify user if password reset is successful
    return res.status(200).send({ message: 'Password has been reset' })
  } catch (error) {
    // Log and send an error message if any server errors are encountered
    console.log(error)
    return res.sendStatus(500)
  }
}

export const getProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" })
    }
    
    const user = await User.getUserById(userId)
    if (!user) {
      return res.status(400).json({ error: "An error occured while fetching user details" })
    }

    return res.status(200).json({ user }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" })
    }

    const { username, email } = req.body
    let profileImage;

    if (req.file) {
      profileImage = req.file.path
    }

    const user = await User.updateProfile(userId, { username, email, profileImage })
    if (!user) {
      return res.status(400).json({ error: "An error occured while updating user profile" })
    }
  
    return res.status(200).json({ user }).end()
  } catch (error) {
    console.log(error)
    return res.sendStatus(500) 
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" })
    }

    await User.deleteUser(userId)

    return res.status(200).json({ message: 'User successfully deleted' })
  } catch (error) {
    console.log(error)
    return res.sendStatus(500)
  }
}