import { Test } from '@nestjs/testing';
import * as pactum from 'pactum';
import { AppModule } from '../../src/app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DbService } from '../../src/db/db.service';
import {
  AuthDto,
  NewPasswordDto,
  PasswordResetDto,
  Verify2FADto,
  VerifyOTPDto
} from "../../src/auth/dto";
import { updateProfileDto } from '../../src/users/dto';
import { SessionService } from '../../src/common/session';

describe('App e2e', () => {
  let app: INestApplication;
  let prisma: DbService;
  let session: SessionService;
  
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Creating and initializing Nest application
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true
    }));
    app.setGlobalPrefix('/api');

    await app.init();
    await app.listen(3333);

    // Cleaning database and session store before running tests
    prisma = app.get(DbService)
    await prisma.cleanDb();
    
    session = app.get(SessionService)
    await session.clear();


    // Set base URL for testing endpoints
    pactum.request.setBaseUrl('http://localhost:3333/api')
  })

  afterAll(() => { app.close() })

  describe('Auth', () => {
    const dto: AuthDto = {
      email: 'example@gmail.com',
      password: 'Xerdin442!',
      firstName: 'Xerdin',
      lastName: null,
    };

    describe('Signup', () => {
      it('should throw if email is empty', () => {
        return pactum.spec()
          .post('/auth/signup')
          .withBody({
            password: dto.password
          })
          .expectStatus(400)
      });
  
      it('should throw if email is invalid', () => {
        return pactum.spec()
          .post('/auth/signup')
          .withBody({
            email: 'invalidEmail',
            password: dto.password
          })
          .expectStatus(400)
      });

      it('should throw if password is empty', () => {
        return pactum.spec()
          .post('/auth/signup')
          .withBody({
            email: dto.email
          })
          .expectStatus(400)
      });

      it('should throw if body is empty', () => {
        return pactum.spec()
          .post('/auth/signup')
          .expectStatus(400)
      });
  
      it('should signup', () => {
        return pactum.spec()
          .post('/auth/signup')
          .withBody(dto)
          .expectStatus(201)
      });

      it('should throw if user with email already exists', () => {
        return pactum.spec()
          .post('/auth/signup')
          .withBody(dto)
          .expectStatus(400)
      });
    });

    describe('Login', () => {
      it('should throw if email is empty', () => {
        return pactum.spec()
          .post('/auth/login')
          .withBody({
            password: dto.password
          })
          .expectStatus(400)
      });
  
      it('should throw if email is invalid', () => {
        return pactum.spec()
          .post('/auth/login')
          .withBody({
            email: 'invalidEmail',
            password: dto.password
          })
          .expectStatus(400)
      });

      it('should throw if no user is found with email', () => {
        return pactum.spec()
          .post('/auth/login')
          .withBody({
            email: 'wrongemail@gmail.com',
            password: dto.password
          })
          .expectStatus(400)
      });

      it('should throw if password is empty', () => {
        return pactum.spec()
          .post('/auth/login')
          .withBody({
            email: dto.email
          })
          .expectStatus(400)
      });

      it('should throw if password is invalid', () => {
        return pactum.spec()
          .post('/auth/login')
          .withBody({
            email: dto.email,
            password: 'wrong password'
          })
          .expectStatus(400)
      });

      it('should throw if body is empty', () => {
        return pactum.spec()
          .post('/auth/login')
          .expectStatus(400)
      });

      it('should login', () => {
        return pactum.spec()
          .post('/auth/login')
          .withBody(dto)
          .expectStatus(200)
          .stores('accessToken', 'token')
      });
    });

    describe('2FA', () => {
      it('should enable two factor authentication', () => {
        return pactum.spec()
          .post('/auth/2fa/enable')
          .withHeaders({
            Authorization: 'Bearer $S{accessToken}'
          })
          .expectStatus(200)
      });
  
      it('should verify 2FA token', () => {
        const verifyDto: Verify2FADto = {
          token: '123456'
        };
  
        return pactum.spec()
          .post('/auth/2fa/verify')
          .withHeaders({
            Authorization: 'Bearer $S{accessToken}'
          })
          .withBody(verifyDto)
          .expectStatus(400)
      });
  
      it('should disable two factor authentication', () => {
        return pactum.spec()
          .post('/auth/2fa/disable')
          .withHeaders({
            Authorization: 'Bearer $S{accessToken}'
          })
          .expectStatus(200)
      });
    });

    describe('Password Reset', () => {
      it('should send password reset OTP to user email', () => {
        const dto: PasswordResetDto = {
          email: 'example@gmail.com'
        };

        return pactum.spec()
          .post('/auth/password/reset')
          .withBody(dto)
          .expectStatus(200)
      });
  
      it('should re-send password reset OTP to user email', () => {  
        return pactum.spec()
          .post('/auth/password/resend-otp')
          .expectStatus(200)
      });
  
      it('should verify password reset OTP', () => {
        const dto: VerifyOTPDto = { 
          otp: '1234'
        };

        return pactum.spec()
          .post('/auth/password/verify-otp')
          .withBody(dto)
          .expectStatus(400)
      });

      it('should should change password and complete reset', () => {
        const dto: NewPasswordDto = {
          newPassword: 'PassWord12!'
        };

        return pactum.spec()
          .post('/auth/password/new')
          .withBody(dto)
          .expectStatus(200)
      });
    })
  });

  describe('User', () => {
    describe('Profile', () => {
      it('should throw if access token is missing', () => {
        return pactum.spec()
          .get('/users/profile')
          .expectStatus(401)
      });

      it('should return profile of logged in user', () => {
        return pactum.spec()
          .get('/users/profile')
          .withHeaders({
            Authorization: 'Bearer $S{accessToken}'
          })
          .expectStatus(200)
      });
    });

    describe('Update Profile', () => {
      const dto: updateProfileDto = {
        email: 'jadawills@gmail.com',
        firstName: 'Nancy'
      };

      it('should update user profile', () => {
        return pactum.spec()
          .patch('/users/profile/update')
          .withHeaders({
            Authorization: 'Bearer $S{accessToken}'
          })
          .withBody(dto)
          .expectStatus(200)
      });
    });

    describe('Delete Account', () => {
      it('should delete user profile', () => {
        return pactum.spec()
          .delete('/users/profile/delete')
          .withHeaders({
            Authorization: 'Bearer $S{accessToken}'
          })
          .expectStatus(200)
      });
    });
  });
})