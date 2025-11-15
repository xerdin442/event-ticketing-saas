# Event Ticketing Saas

This API is a robust backend service designed to facilitate the creation and management of events, and the purchasing of event tickets. It ensures scalability, reliability, and a seamless experience for event organizers and attendees.

## Features

- **User Authentication**: Secure user authentication system, with a guest user feature and role-based access control for organizers and attendees.
- **Event Management**: Creation, update, and cancelllation of events with support for rich metadata like venues, dates, categories and ticket tiers.
- **Trending Events**: Live ranking of trending events based on ticket sales within the last 72hrs.
- **Event Alerts**: Real-time alerts for registered users based on their preferences.
- **Ticketing System**: Support for multiple ticket types with customizable pricing, discounts and validation at event venues.
- **Payments**: Secure and idempotent payment processing for ticket purchases using Paystack.
- **Refunds**: Secure refund process for attendees after event cancellation or unsuccessful ticket purchases.
- **Payouts**: Efficient revenue payout to organizers upon event completion.
- **Metrics and Analytics**: Tracks important metrics like ticket sales, refunds, and unsuccessful transactions.

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

- [Use the sample here](./.env.example) to create two files - `.env` & `.env.test` - for storing and managing the required global environment variables in test and development environments.
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
> To stop the containers, run `npm run compose:down`.

## Endpoints

## Auth API

| Method | Path                                | Description                |
| ------ | ----------------------------------- | -------------------------- |
| POST   | /auth/signup                        | Sign up a new user         |
| POST   | /auth/login                         | Sign in an existing user   |
| POST   | /auth/logout                        | Log out of current session |
| POST   | /auth/password/reset?email          | Request a password reset   |
| POST   | /auth/password/reset/resend?resetId | Resend password reset OTP  |
| POST   | /auth/password/reset/verify         | Verify password reset OTP  |
| POST   | /auth/password/reset/new            | Change current password    |

## Users API

| Method | Path                | Description                                |
| ------ | ------------------- | ------------------------------------------ |
| GET    | /user/profile       | Get user profile                           |
| PATCH  | /user/profile       | Update user profile                        |
| DELETE | /user/profile       | Delete user profile                        |
| GET    | /user/tickets       | Get all event tickets for user             |
| GET    | /user/events?role   | Get all events as an attendee or organizer |
| POST   | /user/alerts?action | Toggle event alerts subscription           |

## Organizer API

| Method | Path               | Description              |
| ------ | ------------------ | ------------------------ |
| GET    | /organizer/profile | Get organizer profile    |
| POST   | /organizer/profile | Create organizer profile |
| PATCH  | /organizer/profile | Update organizer profile |
| DELETE | /organizer/profile | Delete organizer profile |

## Events API

| Method | Path                                | Description                              |
| ------ | ----------------------------------- | ---------------------------------------- |
| POST   | /events/create                      | Create new event                         |
| GET    | /events/?category                   | Get all events (by category, if present) |
| GET    | /events/:eventId                    | Get event details                        |
| PATCH  | /events/:eventId                    | Update event details                     |
| POST   | /events/:eventId/cancel             | Cancel event                             |
| GET    | /events/nearby?latitude=&longitude= | Search for nearby events                 |
| GET    | /events/trending                    | Get trending events                      |
| POST   | /events/:eventId/refund?email       | Initiate ticket refund                   |
| POST   | /events/:eventId/refund/verify      | Verify ticket refund request             |
| POST   | /events/:eventId/refund/process     | Process ticket refund                    |

## Tickets API

| Method | Path                                             | Description                       |
| ------ | ------------------------------------------------ | --------------------------------- |
| GET    | /events/:eventId/tickets/tiers                   | Get all ticket tiers for an event |
| POST   | /events/:eventId/tickets/add                     | Add a ticket tier                 |
| DELETE | /events/:eventId/tickets/:tierId                 | Delete a ticket tier              |
| POST   | /events/:eventId/tickets/:tierId/discount/create | Create discount offer             |
| POST   | /events/:eventId/tickets/:tierId/discount/remove | Remove discount offer             |
| POST   | /events/:eventId/tickets/purchase                | Initiate ticket purchase          |
| POST   | /events/:eventId/tickets/validate                | Validate ticket                   |

## Payments API

| Method | Path               | Description                                      |
| ------ | ------------------ | ------------------------------------------------ |
| GET    | /payments/banks    | Get all Paystack approved bank names             |
| POST   | /payments/callback | Receive webhooks on payment status from Paystack |

> Set the `/payments/callback` endpoint as the webhook URL on your Paystack dashboard.

Happy Ticketing! :rocket:
