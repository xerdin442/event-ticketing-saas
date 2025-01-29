import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { DbService } from "../../../src/db/db.service";
import { Secrets } from "../../../src/common/env";
import { PaymentsService } from "../../../src/payments/payments.service";

describe('Payment Service', () => {
  let prisma: DbService;
  let paymentsService: PaymentsService;

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
    paymentsService = app.get(PaymentsService);
  });
})