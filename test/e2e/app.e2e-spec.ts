import { Test } from '@nestjs/testing';
import { AppModule } from '@src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DbService } from '@src/db/db.service';
import {
  CreateUserDTO,
  LoginDTO,
  NewPasswordDTO,
  VerifyOTPDTO
} from "@src/auth/dto";
import { UpdateProfileDTO } from '@src/users/dto';
import { Secrets } from '@src/common/secrets';
import request from 'supertest'
import path from 'path';
import { CreateEventDTO, UpdateEventDTO } from '@src/events/dto';
import { AddTicketTierDTO, CreateDiscountDTO, CreateListingDTO, PurchaseTicketDTO } from '@src/tickets/dto';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Organizer } from '@generated/client';
import { isArray } from 'class-validator';
import { CreateOrganizerProfileDTO, UpdateOrganizerProfileDTO } from '@src/organizer/dto';
import { randomUUID } from 'crypto';

describe('App e2e', () => {
  let app: INestApplication;
  let prisma: DbService;
  let accessToken: string;
  let eventId: number;
  let resetId: string;
  let organizer: Organizer;
  let tierId: number;
  let ticketId: number;

  const accountDetails = {
    accountName: Secrets.ACCOUNT_NAME,
    accountNumber: Secrets.ACCOUNT_NUMBER,
    bankName: Secrets.BANK_NAME,
  }

  beforeAll(async () => {
    jest.useRealTimers();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));

    await app.init();

    // Clear database before running tests
    prisma = app.get(DbService)
    await prisma.cleanDb();
  });

  afterAll(() => app.close());

  describe('Auth', () => {
    const signupDto: CreateUserDTO = {
      email: 'jadawills3690@gmail.com',
      password: 'Xerdin442!',
      preferences: ['ART', 'TECH']
    };

    describe('Signup', () => {
      it('should throw if email format is invalid', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            ...signupDto,
            email: 'invalidEmail'
          })

        expect(response.status).toEqual(400);
        expect(response.body.message[0]).toEqual('Please enter a valid email address');
      });

      it('should throw if password is not strong enough', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            ...signupDto,
            password: 'password'
          })

        expect(response.status).toEqual(400);
        expect(response.body.message[0]).toEqual('Password must contain at least one uppercase and lowercase letter, one digit and one symbol');
      });

      it('should throw if request body is empty', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')

        expect(response.status).toEqual(400);
      });

      it('should signup', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send(signupDto)

        expect(response.status).toEqual(201);
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
      });
    });

    describe('Login', () => {
      const loginDto: LoginDTO = { ...signupDto };

      it('should throw if email format is invalid', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            ...loginDto,
            email: 'invalidEmail'
          })

        expect(response.status).toEqual(400);
        expect(response.body.message[0]).toEqual('Please enter a valid email address');
      });

      it('should login', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send(loginDto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('token');

        accessToken = response.body.token;
      });
    });

    describe('Password Reset', () => {
      it('should throw if email query parameter is missing', async () => {
        const response = await request(app.getHttpServer())
          .post(`/auth/password/reset`)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Missing required "email" parameter');
      });

      it('should send password reset OTP to user email', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/password/reset')
          .query({ email: signupDto.email })

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('resetId');
        expect(response.body.message).toEqual('Password reset OTP has been sent to your email');

        resetId = response.body.resetId;
      });

      it('should resend password reset OTP to user email', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/password/reset/resend')
          .query({ resetId })

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Another reset OTP has been sent to your email');
      });

      it('should verify password reset OTP', async () => {
        const dto: VerifyOTPDTO = {
          resetId,
          otp: '1234'
        };
        const response = await request(app.getHttpServer())
          .post('/auth/password/reset/verify')
          .send(dto)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Invalid OTP');
      });

      it('should change password and complete reset', async () => {
        const dto: NewPasswordDTO = {
          resetId,
          newPassword: 'PassWord12!'
        };
        const response = await request(app.getHttpServer())
          .post('/auth/password/reset/new')
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Password reset complete!');
      });
    });
  });

  describe('User', () => {
    describe('Get Profile', () => {
      it('should throw if access token is missing', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/profile')

        expect(response.status).toEqual(403);
        expect(response.body.message).toEqual('Forbidden resource');
      });

      it('should return user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/profile')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('user');
      });
    });

    describe('Update Profile', () => {
      const dto: UpdateProfileDTO = {
        preferences: ['MUSIC', 'FASHION', 'NIGHTLIFE']
      };

      it('should update user profile', async () => {
        const response = await request(app.getHttpServer())
          .patch('/user/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.preferences).toEqual(dto.preferences);
      });
    });

    describe('Get All Events', () => {
      it('should return all user events as organizer', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/events')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ role: 'organizer' })

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('events');
        expect(isArray(response.body.events)).toBe(true);
      });

      it('should return all user events as attendee', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/events')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ role: 'attendee' })

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('events');
        expect(isArray(response.body.events)).toBe(true);
      });

      it('should throw if role query parameter is missing', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/events')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Missing required "role" parameter');
      });
    });

    describe('Get All Tickets', () => {
      it('should return all user tickets', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/tickets')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('tickets');
        expect(isArray(response.body.tickets)).toBe(true);
      });
    });

    describe('Alerts Subscription', () => {
      it('should throw if action query parameter is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/user/alerts')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Missing required "action" parameter');
      });

      it('should turn on event alerts for user', async () => {
        const response = await request(app.getHttpServer())
          .post('/user/alerts')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ action: 'subscribe' })

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Event alerts subscription successful');
      });

      it('should turn off event alerts for user', async () => {
        const response = await request(app.getHttpServer())
          .post('/user/alerts')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ action: 'unsubscribe' })

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Event alerts turned off successfully');
      });
    });
  });

  describe('Organizer', () => {
    describe('Create Organizer Profile', () => {
      const dto: CreateOrganizerProfileDTO = {
        ...accountDetails,
        email: 'organizer@example.com',
        name: 'Test Organizer',
        phone: '9876543210'
      };

      it('should create organizer profile', async () => {
        const response = await request(app.getHttpServer())
          .post('/organizer/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(201);
        expect(response.body).toHaveProperty('organizer');
      }, 30000);
    });

    describe('Get Organizer Profile', () => {
      it('should return organizer profile of logged in user', async () => {
        const response = await request(app.getHttpServer())
          .get('/organizer/profile')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('organizer');

        organizer = response.body.organizer;
      });

      it('should return organizer profile by ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/organizer/${organizer.id}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('organizer');
      });
    });

    describe('Update Organizer Profile', () => {
      const dto: UpdateOrganizerProfileDTO = {
        phone: '1234567890',
        website: 'https://www.organizer.com'
      };

      it('should update organizer profile', async () => {
        const response = await request(app.getHttpServer())
          .patch('/organizer/profile')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('organizer');
      });
    });
  });

  describe('Events', () => {
    describe('Create Event', () => {
      const dto: CreateEventDTO = {
        title: 'Test Event',
        description: 'This is a test event',
        category: 'MUSIC',
        capacity: 20000,
        address: 'Asaba',
        venue: 'Shoprite',
        date: new Date('2025-12-26T00:00:00Z'),
        startTime: new Date('2025-12-26T17:00:00Z'),
        endTime: new Date('2025-12-26T22:00:00Z'),
      };

      it('should create a new event', async () => {
        const response = await request(app.getHttpServer())
          .post('/events/create')
          .set('Authorization', `Bearer ${accessToken}`)
          .field({
            ...dto,
            date: dto.date.toISOString(),
            startTime: dto.startTime.toISOString(),
            endTime: dto.endTime.toISOString()
          })
          .attach('poster', path.resolve(__dirname, 'test-image.jpg'))

        expect(response.status).toEqual(201);
        expect(response.body).toHaveProperty('event');

        eventId = response.body.event.id;
      }, 10000);
    });

    describe('Update Event', () => {
      const dto: UpdateEventDTO = {
        description: 'This is an updated event description',
        ageRestriction: 18
      };

      it('should update event by ID', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/events/${eventId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('event');
      });
    });

    describe('Event Details', () => {
      it('should return details of event by ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('event');
      });
    });

    describe('Explore Events', () => {
      it('should return all events based on category filter', async () => {
        const response = await request(app.getHttpServer())
          .get('/events?category=ART&category=MUSIC&category=SPORTS')

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('events');
        expect(isArray(response.body.events)).toBe(true);
      });

      it('should throw if filter contains invalid event category', async () => {
        const response = await request(app.getHttpServer())
          .get('/events?category=ART&category=INVALID&category=SPORTS')

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Invalid category value: INVALID');
      });
    });

    describe('Nearby Events', () => {
      it('should return all nearby events', async () => {
        const response = await request(app.getHttpServer())
          .get('/events/nearby')
          .query({
            latitude: "6.21407043245160651",
            longitude: "6.70151799917221069"
          })

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('events');
        expect(isArray(response.body.events)).toBe(true);
      });
    });

    describe('Trending Events', () => {
      it('should return all trending events', async () => {
        const response = await request(app.getHttpServer())
          .get('/events/trending')

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('events');
        expect(isArray(response.body.events)).toBe(true);
      });
    });
  });

  describe('Tickets', () => {
    describe('Add Ticket Tier', () => {
      const dto: AddTicketTierDTO = {
        name: 'VIP',
        price: 200000,
        discount: false,
        totalNumberOfTickets: 200
      };

      it('should add a ticket tier to the event', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/add`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('tier');

        tierId = response.body.tier.id;
      });
    });

    describe('Ticket Tier Details', () => {
      it('should return all ticket tiers for an event', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/tickets/tiers`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('tickets');
        expect(isArray(response.body.tickets)).toBe(true);
      });
    });

    describe('Create Discount Offer', () => {
      const dto: CreateDiscountDTO = {
        discountPrice: 175000,
        discountExpiration: new Date('2025-12-20T00:00:00Z'),
        numberOfDiscountTickets: 20
      };

      it('should create a discount offer for ticket tier', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/${tierId}/discount/create`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Disocunt offer created successfully');
      });
    });

    describe('Purchase Ticket', () => {
      const dto: PurchaseTicketDTO = {
        email: 'xerdinludac@gmail.com',
        quantity: 2,
        tier: 'VIP'
      };

      it('should throw if idempotency key is missing', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/purchase`)
          .send(dto)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Idempotency-Key header is required');
      });

      it('should return a Paystack checkout link', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/purchase`)
          .set('Authorization', `Bearer ${accessToken}`)
          .set('Idempotency-Key', 'random-unique-string')
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('checkout');
      }, 10000);
    });

    describe('Remove Discount Offer', () => {
      it('should remove discount offer from ticket tier', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/${tierId}/discount/remove`)
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Disocunt offer removed successfully');
      });
    });

    describe('Ticket Resale', async () => {
      const ticket = await prisma.ticket.create({
        data: {
          accessKey: randomUUID(),
          attendee: 'jadawills3690@gmail.com',
          price: 5000,
          tier: 'VIP',
          eventId,
        },
      });
      ticketId = ticket.id;

      it('should return all tickets listed for resale', async () => {
        const response = await request(app.getHttpServer())
          .get(`/events/${eventId}/tickets/marketplace`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('listings');
        expect(Array.isArray(response.body.listings)).toBe(true);
      });

      it('should list a ticket for resale', async () => {
        const dto: CreateListingDTO = {
          accessKey: ticket.accessKey,
          ...accountDetails,
        }

        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/${ticketId}/listing`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto);

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Your ticket has been listed for resale');
      });

      it('should throw if email query parameter is missing in purchase of listed ticket', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/${ticketId}/listing/buy`)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Missing required "email" parameter');
      });

      it('should initiate purchase of listed ticket', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/${ticketId}/listing/buy`)
          .query({ email: 'xerdinludac@gmail.com' });

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('checkout');
      });

      it('should remove a listed ticket from resale marketplace', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/events/${eventId}/tickets/${ticketId}/listing`)
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Your ticket has been removed from resale marketplace');
      });
    });
  });

  describe('Payments', () => {
    describe('Supported Banks', () => {
      it('should return list of banks supported by Paystack', async () => {
        const response = await request(app.getHttpServer())
          .get('/payments/banks')

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('banks');
        expect(isArray(response.body.banks)).toBe(true);
      })
    });

    describe('Webhook', () => {
      it('should throw if authorization signature is invalid', async () => {
        const payload = { event: 'charge.success', data: {} };

        const response = await request(app.getHttpServer())
          .post('/payments/callback')
          .send(payload);

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Invalid authorization signature');
      })
    });
  });

  describe('Cleanup', () => {
    it('should remove ticket tier', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/events/${eventId}/tickets/${tierId}`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toEqual(200);
      expect(response.body.message).toEqual('Ticket tier deleted successfully');
    });

    it('should cancel existing event', async () => {
      const response = await request(app.getHttpServer())
        .post(`/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toEqual(200);
      expect(response.body.message).toEqual('Event cancellation successful');
    });

    it('should delete organizer profile', async () => {
      const response = await request(app.getHttpServer())
        .delete('/organizer/profile')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toEqual(200);
      expect(response.body.message).toEqual('Organizer profile deleted successfully');
    });

    it('should log out current user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toEqual(200);
      expect(response.body.message).toEqual('Logout successful!');
    });

    it('should throw if token is blacklisted', async () => {
      const response = await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(response.status).toEqual(401);
      expect(response.body.message).toEqual('Session expired. Please log in.');
    });
  });
});