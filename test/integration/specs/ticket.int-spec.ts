import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module";
import { DbService } from "../../../src/db/db.service";
import { Secrets } from "../../../src/common/env";
import { Event, User } from "@prisma/client";
import {
  AddTicketTierDto
} from "../../../src/tickets/dto";
import { TicketsService } from "../../../src/tickets/tickets.service";

describe('Ticket Service', () => {
  let prisma: DbService;
  let ticketService: TicketsService;
  let user: User;
  let event: Event;

  const ticketTierDto: AddTicketTierDto = {
    name: 'VIP',
    price: '200000',
    discount: false,
    totalNumberOfTickets: '200',
  }

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
    ticketService = app.get(TicketsService);

    user = await prisma.user.create({
      data: {
        email: 'ticket@example.com',
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
})