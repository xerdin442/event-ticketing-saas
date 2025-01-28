# Event Ticketing Saas

This API is a robust backend service designed to facilitate the creation and management of events, and the purchasing of event tickets. It ensures scalability, reliability, and a seamless experience for event organizers and attendees.

## Features

- **User Authentication**: Secure user authentication system, with an option to enable 2FA for added security, and role-based access control for organizers and attendees.
- **Event Management**: Create, update, and cancel events with support for rich metadata like venues, dates, and ticket categories.
- **Ticketing System**: Supports multiple ticket types with customizable pricing, discounts and validation at event venues.
- **Payments**: Secure and idempotent payment processing for ticket purchases using Paystack.
- **Refund and Revenue Splitting**: Automated refunds to attendees after event cancellation or unsuccessful ticket purchases, and revenue distribution for organizers.
- **Metrics and Analytics**: Tracks important metrics like refunds and unsuccessful transactions using Prometheus-compatible endpoints.
- **Websockets**: Real-time event updates via websockets for status of ticket purchase transactions.
- **Queue Management**: Optimized asynchronous processing using queues for abstracting purchases, refunds and notifications from the main application workflow.

## Deployment

:globe_with_meridians: A live deployment link is available upon request

## Tech Stack

- **Framework**: NestJS
- **Database**: Postgres
- **Blob Storage**: Cloudinary
- **Caching**: Redis
- **Queues**: BullMQ
- **Mail**: Brevo
- **Tests**: Jest & Supertest
- **Metrics**: Prometheus-compatible metrics

## Getting Started

Clone this repository and follow the instructions to set up the project locally:

1. Run `npm install` to install all the project dependencies.
1. [Use the sample here](./.env.example) to create three files - `.env`, `.env.test` and `.env.local` - for storing and managing the required environment variables.
1. The database schema has been migrated. But if you make changes to the [schema file](prisma/schema.prisma), apply the migrations with the following steps;
   - Start the database container: `docker-compose up -d database`
   - Run the migrations: `npx dotenv -e .env.local -- npm run migrate`
1. Containerization;

   - Create a repository on Docker hub
   - Create a Dockerfile in the root directory and paste this;

   ```
   FROM node:latest
   WORKDIR /usr/src/app
   COPY package.json .

   ARG NODE_ENV
   RUN if [ "$NODE_ENV" = "development" ]; \
         then npm install -f; \
         else npm install -f --only=production; \
         fi

   COPY . .
   EXPOSE 3000
   CMD [ "npm", "start" ]
   ```

   > I removed `Dockerfile` from git tracking because of my deployment strategy on Railway. Feel free to add it to git if needed

   - Build the image: `docker build -t docker-username/repository-name:version-number .`
   - Push the image: `docker push docker-username/repository-name:version-number`
   - Update the `BUILD_IMAGE` environment variable and run `docker-compose pull`
   - Start the containers: `docker-compose -f compose.yml -f compose.dev.yml up -d`

1. Check the logs of the `backend` container on Docker Desktop. When the Nest application is fully initialized, it should be running at: `http://localhost:3000/`
1. After making any changes to the application source code or applying new migrations, repeat steps 4(leave out the first two sub-steps) and 5.
1. Tests;
   - Start the test containers: `docker-compose -f compose.test.yml up -d`
   - For end-to-end tests: `npm run test:e2e`

     > In [app.module.ts](src/app.module.ts), comment out the **ThrottlerModule** configuration from the imports and **ThrottlerGuard** object in the **providers** array. This is to avoid rate limiting errors in the end-to-end tests.

     > Also, comment out the `password` property in the **BullModule** configuration.

   - For integration tests: `npm run test:int`
     > Add `--remove-orphans` flag when stopping the test containers
1. Below are the available endpoints, each one is prefixed with '/api'.

## Auth API

| Method | Path                      | Description                        |
| ------ | ------------------------- | ---------------------------------- |
| POST   | /auth/signup              | Sign up a new user                 |
| POST   | /auth/login               | Sign in an existing user           |
| POST   | /auth/2fa/enable          | Enable 2FA                         |
| POST   | /auth/2fa/disable         | Disable 2FA                        |
| POST   | /auth/2fa/verify          | Verify code from authenticator app |
| POST   | /auth/password/reset      | Request a password reset           |
| POST   | /auth/password/resend-otp | Resend password reset OTP          |
| POST   | /auth/password/verify-otp | Verify password reset OTP          |
| POST   | /auth/password/new        | Change current password            |

## Users API

| Method | Path                  | Description                                |
| ------ | --------------------- | ------------------------------------------ |
| GET    | /users/profile        | Get user profile                           |
| PATCH  | /users/profile/update | Update user profile                        |
| DELETE | /users/profile/delete | Delete user profile                        |
| GET    | /users/tickets        | Get all event tickets for user             |
| GET    | /users/events?role    | Get all events as an attendee or organizer |

## Organizer API

| Method | Path                    | Description              |
| ------ | ----------------------- | ------------------------ |
| GET    | /users/organizer        | Get organizer profile    |
| POST   | /users/organizer/create | Create organizer profile |
| PATCH  | /users/organizer/update | Update organizer profile |
| DELETE | /users/organizer/delete | Delete organizer profile |

## Events API

| Method | Path                    | Description              |
| ------ | ----------------------- | ------------------------ |
| POST   | /events/create          | Create new event         |
| GET    | /events/:eventId        | Get event details        |
| PATCH  | /events/:eventId/update | Update event details     |
| POST   | /events/:eventId/cancel | Cancel event             |
| POST   | /events/nearby          | Search for nearby events |

## Tickets API

| Method | Path                                          | Description                            |
| ------ | --------------------------------------------- | -------------------------------------- |
| POST   | /events/:eventId/tickets/add                  | Add a ticket tier                      |
| POST   | /events/:eventId/tickets/remove-discount?tier | Remove discount offer from ticket tier |
| POST   | /events/:eventId/tickets/purchase             | Initiate ticket purchase               |
| POST   | /events/:eventId/tickets/validate             | Validate ticket                        |

## Payments API

| Method | Path               | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| GET    | /payments/banks    | Get all Paystack approved bank names             |
| POST   | /payments/callback | Receive webhooks on payment status from Paystack |

> Set the `/payments/callback` endpoint as the webhook URL on your Paystack dashboard.

Happy Ticketing! :rocket:
