import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoose from 'mongoose';
import connectMongoDBSession from 'connect-mongodb-session';
import session from 'express-session';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server, WebSocket } from 'ws';

import router from './shared/index.router';
import sessionDts from '../types/session';
import { updateEventStatus } from './events/event.service';

// Initialize express app and create a server
const app = express()
const server = createServer(app)
const wss = new Server({ server }) // Initialize a websocket server

dotenv.config(); // Load environment variables

// Initialize and configure middlewares
app.use(cors({ credentials: true }))
app.use(compression())
app.use(bodyParser.json({ limit: "50mb" }))
app.use(cookieParser())
app.use(helmet())

// Configure session middleware
const MongoDBStore = connectMongoDBSession(session);
const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: 'sessions'
})
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: store,
  cookie: { maxAge: 1000 * 60 * 60 * 3, secure: false } // Set expiration time of cookie
}))

app.use('/api', router()) // Initialize routes

// Store active WebSocket connections
export const clients: Record<string, WebSocket> = {};

// WebSocket server connection event
wss.on('connection', (ws, req) => {
  const userId = req.url?.split('/').pop(); // Extract user id from the URL

  if (userId) {
    clients[userId] = ws; // Store client connection with user id
  }

  ws.on('close', () => {
    delete clients[userId as string]; // Remove client connection when closed
  });
});

// Connect to database and start the server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(process.env.PORT)
    console.log('Server is running on port 3000')

    // Check database regularly and update status of events
    setInterval(async () => await updateEventStatus(), 15 * 60 * 1000);
  })
  .catch(err => console.log(err))