import { Request, Response, NextFunction } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken';

export const isLoggedIn = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers['authorization'] // Extract the header value
  if (!header) {
    return res.status(400).json({ error: "Access denied. Invalid header!" })
  }

  const authorization = header as string // Cast header value as a string
  const token = authorization.split(' ')[1] // Extract token value from header string value
  if (!token) {
    return res.status(400).json({ error: "Access denied. Invalid token!" })
  }

  try {
    // Verify and extract payload from authorization token
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (!payload) {
      return res.status(400).json({ error: "Access denied. An error occured while verifying token!" })
    }

    req.session.user = payload as JwtPayload // Initialize a new session using the extracted payload data
    next()
  } catch (error) {
    // Check if the token has expired and prompt the user to login
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Your session has expired. Log in to continue" });
    } else {
      console.log(error)
      return res.sendStatus(500)
    }
  }
}