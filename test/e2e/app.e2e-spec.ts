import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DbService } from '../../src/db/db.service';
import {
  CreateUserDto,
  LoginDto,
  NewPasswordDto,
  PasswordResetDto,
  Verify2FADto,
  VerifyOTPDto
} from "../../src/auth/dto";
import {
  CreateOrganizerProfileDto,
  UpdateOrganizerProfileDto,
  UpdateProfileDto
} from '../../src/users/dto';
import { SessionService } from '../../src/common/session';
import { Secrets } from '../../src/common/env';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest'
import path from 'path';
import {
  CreateEventDto,
  NearbyEventsDto,
  UpdateEventDto
} from '../../src/events/dto';
import {
  AddTicketTierDto,
  PurchaseTicketDto
} from '../../src//tickets/dto';

describe('App e2e', () => {
  let app: INestApplication;
  let prisma: DbService;
  let session: SessionService;
  let accessToken: string;
  let eventId: number;

  beforeAll(async () => {
    jest.useRealTimers();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Creating and initializing Nest application
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true
    }));
    app.useWebSocketAdapter(new WsAdapter(app));

    await app.init();

    // Cleaning database and session store before running tests
    prisma = app.get(DbService)
    await prisma.cleanDb();

    session = app.get(SessionService)
    await session.onModuleInit();
    await session.clear();
  });

  afterAll(() => app.close());

  describe('Auth', () => {
    const signupDto: CreateUserDto = {
      email: 'jadawills3690@gmail.com',
      password: 'Xerdin442!',
      age: '21',
      accountName: Secrets.ACCOUNT_NAME,
      accountNumber: Secrets.ACCOUNT_NUMBER,
      bankName: Secrets.BANK_NAME,
      firstName: 'Xerdin',
      lastName: 'Ludac'
    }

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
      }, 10000);
    });

    describe('Login', () => {
      const loginDto: LoginDto = {
        email: signupDto.email,
        password: signupDto.password
      };

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
        expect(response.body).toHaveProperty('twoFactorAuth');

        accessToken = response.body.token;
      });
    });

    describe('2FA', () => {
      it('should enable two factor authentication', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/2fa/enable')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('qrcode');
      });

      it('should verify 2FA token', async () => {
        const dto: Verify2FADto = {
          token: '123456'
        };
        const response = await request(app.getHttpServer())
          .post('/auth/2fa/verify')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Invalid token');
      });

      it('should disable two factor authentication', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/2fa/disable')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('2FA disabled successfully');
      });
    });

    describe('Password Reset', () => {
      it('should send password reset OTP to user email', async () => {
        const dto: PasswordResetDto = {
          email: signupDto.email
        };
        const response = await request(app.getHttpServer())
          .post('/auth/password/reset')
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Password reset OTP has been sent to your email');
      });

      it('should re-send password reset OTP to user email', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/password/resend-otp')

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Another OTP has been sent to your email');
      });

      it('should verify password reset OTP', async () => {
        const dto: VerifyOTPDto = {
          otp: '1234'
        };
        const response = await request(app.getHttpServer())
          .post('/auth/password/verify-otp')
          .send(dto)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Invalid OTP');
      });

      it('should change password and complete reset', async () => {
        const dto: NewPasswordDto = {
          newPassword: 'PassWord12!'
        };
        const response = await request(app.getHttpServer())
          .post('/auth/password/new')
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Password reset complete!');
      });
    })
  });

  describe('User', () => {
    describe('Profile', () => {
      it('should throw if access token is missing', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile')

        expect(response.status).toEqual(401);
        expect(response.body.message).toEqual('Unauthorized');
      });

      it('should return user profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/profile')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('user');
      });
    });

    describe('Update Profile', () => {
      const dto: UpdateProfileDto = {
        firstName: 'Nancy',
        age: '25'
      };

      it('should update user profile', async () => {
        const response = await request(app.getHttpServer())
          .patch('/users/profile/update')
          .set('Authorization', `Bearer ${accessToken}`)
          .field({ ...dto })
          .attach('profileImage', path.resolve(__dirname, 'test-image.jpg'))

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('user');
      }, 10000);
    });

    describe('Get All Events', () => {
      it('should return all user events as organizer', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/events')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ role: 'organizer' })

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('events');
      });

      it('should return all user events as attendee', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/events')
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ role: 'attendee' })

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('events');
      });

      it('should throw if query parameter is missing', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/events')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Missing "role" query parameter.');
      });
    });

    describe('Get All Tickets', () => {
      it('should return all user tickets', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/tickets')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('tickets');
      });
    });
  });

  describe('Organizer', () => {
    describe('Create Organizer Profile', () => {
      const dto: CreateOrganizerProfileDto = {
        accountName: Secrets.ACCOUNT_NAME,
        accountNumber: Secrets.ACCOUNT_NUMBER,
        bankName: Secrets.BANK_NAME,
        email: 'organizer@example.com',
        name: 'Test Organizer',
        phone: '9876543210'
      };

      it('should create organizer profile', async () => {
        const response = await request(app.getHttpServer())
          .post('/users/organizer/create')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(201);
        expect(response.body).toHaveProperty('organizer');
      }, 10000);
    });

    describe('Get Organizer Profile', () => {
      it('should return organizer profile', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/organizer')
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('organizer');
      });
    });

    describe('Update Organizer Profile', () => {
      const dto: UpdateOrganizerProfileDto = {
        phone: '1234567890',
        website: 'https://www.organizer.com'
      };

      it('should update organizer profile', async () => {
        const response = await request(app.getHttpServer())
          .patch('/users/organizer/update')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('organizer');
      });
    });
  });

  describe('Events', () => {
    describe('Create Event', () => {
      const dto: CreateEventDto = {
        title: 'Test Event',
        description: 'This is a test event',
        category: 'ENTERTAINMENT',
        capacity: '20000',
        address: 'Asaba',
        venue: 'Shoprite',
        date: '2025-01-28T00:00:00Z',
        endTime: '2025-01-28T22:00:00Z',
        startTime: '2025-01-28T17:00:00Z'
      };

      it('should create a new event', async () => {
        const response = await request(app.getHttpServer())
          .post('/events/create')
          .set('Authorization', `Bearer ${accessToken}`)
          .field({ ...dto })
          .attach('poster', path.resolve(__dirname, 'test-image.jpg'))

        expect(response.status).toEqual(201);
        expect(response.body).toHaveProperty('event');

        eventId = response.body.event.id;
      }, 10000);
    });

    describe('Update Event', () => {
      const dto: UpdateEventDto = {
        date: '2025-01-29T00:00:00Z',
        endTime: '2025-01-29T22:00:00Z',
        startTime: '2025-01-29T17:00:00Z'
      };

      it('should update event by ID', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/events/${eventId}/update`)
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
          .set('Authorization', `Bearer ${accessToken}`)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('event');
      });
    });

    describe('Nearby Events', () => {
      const dto: NearbyEventsDto = {
        latitude: "6.21407043245160651",
        longitude: "6.70151799917221069"
      };

      it('should return all nearby events', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/nearby`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
      });
    });
  });

  describe('Tickets', () => {
    describe('Add Ticket Tier', () => {
      const dto: AddTicketTierDto = {
        name: 'VIP',
        price: '200000',
        discount: false,
        totalNumberOfTickets: '200'
      };

      it('should add a ticket tier to the event', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/add`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body.message).toEqual('Ticket tier added successfully!')
      });
    });

    describe('Purchase Ticket', () => {
      const dto: PurchaseTicketDto = {
        quantity: 2,
        tier: 'VIP'
      };

      it('should throw if idempotency key is missing', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/purchase`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(dto)

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual('Idempotency-Key header is required');
      });

      it('should return a Paystack checkout link', async () => {
        const response = await request(app.getHttpServer())
          .post(`/events/${eventId}/tickets/purchase`)
          .set('Authorization', `Bearer ${accessToken}`)
          .set('Idempotency-Key', 'random-string-442')
          .send(dto)

        expect(response.status).toEqual(200);
        expect(response.body).toHaveProperty('checkout');
      }, 10000);
    });
  });

  describe('Payments', () => {
    describe('Webhook', () => {
      it('should return 200 OK status', async () => {
        const response = await request(app.getHttpServer())
          .post('/payments/callback')

        expect(response.status).toEqual(200);
      })
    })
  })
});