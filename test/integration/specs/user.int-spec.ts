import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { DbService } from "../../../src/db/db.service";
import { UserService } from "../../../src/users/users.service";
import { updateProfileDto } from "../../../src/users/dto";
import { ConfigService } from "@nestjs/config";
import { Secrets } from "../../../src/common/env";

describe('User Service', () => {
  let prisma: DbService;
  let userService: UserService;
  let userId: number;
  let config: ConfigService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Creating and initializing Nest application
    const app = moduleRef.createNestApplication();

    // Database teardown logic before running tests
    prisma = app.get(DbService)
    await prisma.cleanDb();

    // Instantiate user service
    userService = app.get(UserService)
    config = app.get(ConfigService)
  });

  describe('Update Profile', () => {
    it('should create user', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'hey@example.com',
          password: 'password',
          age: 21,
          accountName: Secrets.ACCOUNT_NAME,
          accountNumber: Secrets.ACCOUNT_NUMBER,
          bankName: Secrets.BANK_NAME,
          firstName: 'Xerdin',
          lastName: 'Ludac',
          profileImage: Secrets.DEFAULT_IMAGE
        }
      })

      userId = user.id;
    });

    it('should update user profile', async () => {
      const dto: updateProfileDto = {
        email: 'updatedemail@gmail.com'
      };

      await userService.updateProfile(userId, dto)
    })
  });

  describe('Get All Events', () => {
    it('should return all events based on the role', async () => {
      await userService.getAllEvents('organizer', userId)
    })
  });

  describe('Get All Tickets', () => {
    it('should return all user tickets', async () => {
      await userService.getAllTickets(userId)
    })
  });

  describe('Delete Account', () => {
    it('should delete user profile', async () => {
      await userService.deleteAccount(userId)
    })
  });
})