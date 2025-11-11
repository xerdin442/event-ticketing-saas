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

:globe_with_meridians: **A live deployment link and Postman collection is available upon request**

## Tech Stack

- **Framework**: NestJS
- **Database**: Postgres
- **Blob Storage**: Cloudinary
- **Caching**: Redis
- **Queues**: BullMQ
- **Mail**: Resend
- **Tests**: Jest & Supertest
- **Metrics**: Prometheus and Grafana

## Getting Started

Clone this repository and follow the instructions to set up the project locally:

### 1. Installation

- Run `npm install` to install all the project dependencies.

### 2. Environment Variables

- [Use the sample here](./.env.example) to create three files - `.env`, `.env.test` and `.env.local` - for storing and managing the required global environment variables in test and development environments.
- `localhost` should be the hostname for all external service urls (database and redis) in the `.env.test` file. This will connect the test environment to the same docker instances as `docker.host.internal` in the `compose.test.yml` file.

### 3. Database Migrations

The database schema is located [here](prisma/schema.prisma). If no schema changes are needed, move to the next step. If you make changes to the schema, follow these steps to run migrations locally:

- Start the database container: `npm run compose:db` (**ensure Docker Desktop is running!**)
- Run the migrations: `npm run migrate`

### 4. Initialization

- Start the storage and monitoring services: `npm run compose:up`
- Start the server: `npm run start:dev`
- When the Nest application is fully initialized, the server should be running at: `http://localhost:3000`
  > The Nest application runs outside Docker.

### 5. Tests

- For integration tests, run: `npm run test:int`
- For end-to-end tests, run;
  - Start the test containers: `npm run compose:test`
  - Run the tests: `npm run test:e2e`

### 6. Monitoring

- To view the custom application metrics on Grafana, visit: `http://localhost:3002`.
- If you add new metrics, update the dashboard [config file](./monitoring/grafana/dashboards/observability.json).

<br>

> If you make changes to any of the compose files in test or development, restart the containers using: `npm run compose:restart`.
> To kill the containers, run `npm run compose:down`.

## Endpoints

## Auth API

| Method | Path                      | Description                        |
| ------ | ------------------------- | ---------------------------------- |
| POST   | /auth/signup              | Sign up a new user                 |
| POST   | /auth/login               | Sign in an existing user           |
| POST   | /auth/logout              | Sign out a logged in user          |
| POST   | /auth/2fa/enable          | Enable 2FA                         |
| POST   | /auth/2fa/disable         | Disable 2FA                        |
| POST   | /auth/2fa/verify          | Verify code from authenticator app |
| POST   | /auth/password/reset      | Request a password reset           |
| POST   | /auth/password/resend-otp | Resend password reset OTP          |
| POST   | /auth/password/verify-otp | Verify password reset OTP          |
| POST   | /auth/password/new        | Change current password            |

## Users API

| Method | Path               | Description                                |
| ------ | ------------------ | ------------------------------------------ |
| GET    | /users/profile     | Get user profile                           |
| PATCH  | /users/profile     | Update user profile                        |
| DELETE | /users/profile     | Delete user profile                        |
| GET    | /users/tickets     | Get all event tickets for user             |
| GET    | /users/events?role | Get all events as an attendee or organizer |

## Organizer API

| Method | Path             | Description              |
| ------ | ---------------- | ------------------------ |
| GET    | /users/organizer | Get organizer profile    |
| POST   | /users/organizer | Create organizer profile |
| PATCH  | /users/organizer | Update organizer profile |

## Events API

| Method | Path                    | Description              |
| ------ | ----------------------- | ------------------------ |
| POST   | /events/create          | Create new event         |
| GET    | /events/:eventId        | Get event details        |
| PATCH  | /events/:eventId        | Update event details     |
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
