import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { DbService } from "../../../src/db/db.service";
import { UserService } from "../../../src/users/users.service";
import {
  CreateOrganizerProfileDto,
  UpdateOrganizerProfileDto,
  UpdateProfileDto
} from "../../../src/users/dto";
import { Secrets } from "../../../src/common/env";
import { User } from "@prisma/client";

describe('User Service', () => {
  let prisma: DbService;
  let userService: UserService;
  let user: User;

  beforeAll(async () => {
    jest.useRealTimers();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Creating and initializing Nest application
    const app = moduleRef.createNestApplication();

    // Database teardown logic before running tests
    prisma = app.get(DbService)
    await prisma.cleanDb();

    // Instantiate user service
    userService = app.get(UserService);

    user = await prisma.user.create({
      data: {
        email: 'user@example.com',
        password: 'password',
        age: 21,
        accountName: Secrets.ACCOUNT_NAME,
        accountNumber: Secrets.ACCOUNT_NUMBER,
        bankName: Secrets.BANK_NAME,
        firstName: 'Xerdin',
        lastName: 'Ludac',
        profileImage: Secrets.DEFAULT_IMAGE
      }
    });
  });

  describe('Update Profile', () => {
    it('should update user profile', async () => {
      const dto: UpdateProfileDto = {
        email: 'updatedemail@gmail.com'
      };

      await userService.updateProfile(user.id, dto)
    })
  });

  describe('Get All Events', () => {
    it('should throw if role parameter is invalid', async () => {
      await expect(userService.getAllEvents('invalid-role', user.id))
        .rejects.toThrow('Invalid value for role parameter. Expected "organizer" or "attendee".');
    });

    it('should return all events based on the role', async () => {
      await userService.getAllEvents('organizer', user.id);
    });
  });

  describe('Get All Tickets', () => {
    it('should return all user tickets', async () => {
      await userService.getAllTickets(user.id)
    })
  });

  describe('Create Organzier Profile', () => {
    const dto: CreateOrganizerProfileDto = {
      accountName: Secrets.ACCOUNT_NAME,
      accountNumber: Secrets.ACCOUNT_NUMBER,
      bankName: Secrets.BANK_NAME,
      email: 'organizer@example.com',
      name: 'Test Organizer',
      phone: '9876543210'
    };

    it('should create organizer profile for user', async () => {
      await userService.createOrganizerProfile(user.id, dto);
    }, 10000);

    it('should throw if user already has an organizer profile', async () => {
      await expect(userService.createOrganizerProfile(user.id, dto))
        .rejects.toThrow('This user already has an organizer profile');
    })
  });

  describe('Update Organizer Profile', () => {
    const dto: UpdateOrganizerProfileDto = {
      phone: '1234567890',
      website: 'https://www.organizer.com'
    };

    it('should throw if website URL is invalid', async () => {
      await expect(userService.updateOrganizerProfile(
        user.id, { ...dto, website: 'http:/invalid-url' }))
        .rejects.toThrow('Please enter a valid webiste URL');
    });

    it('should update organizer profile', async () => {
      await userService.updateOrganizerProfile(user.id, dto);
    });
  });

  describe('Get Organizer Profile', () => {
    it('should return organizer profile for user', async () => {
      await userService.getOrganizerProfile(user.id);
    });
  });

  describe('Delete Account', () => {
    it('should delete user profile', async () => {
      await userService.deleteAccount(user.id);
    })
  });
})