import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { DbService } from "../../../src/db/db.service";
import { UserService } from "../../../src/users/users.service";
import { updateProfileDto } from "../../../src/users/dto";
import { ConfigService } from "@nestjs/config";

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
          email: 'example@gmail.com',
          password: 'password',
          profileImage: config.get<string>('DEFAULT_IMAGE')
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

  describe('Delete Account', () => {
    it('should delete user profile', async () => { 
      await userService.deleteAccount(userId)
    })
  });
})