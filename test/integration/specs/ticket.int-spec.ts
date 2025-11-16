import { Test } from "@nestjs/testing";
import { AppModule } from "@src/app.module";
import { DbService } from "@src/db/db.service";
import { Secrets } from "@src/common/secrets";
import { Event, Ticket, User } from "@prisma/client";
import {
  AddTicketTierDto,
  PurchaseTicketDto,
  ValidateTicketDto
} from "@src/tickets/dto";
import { TicketsService } from "@src/tickets/tickets.service";

describe('Ticket Service', () => {
  let prisma: DbService;
  let ticketService: TicketsService;
  let user: User;
  let event: Event;
  let ticket: Ticket;

  const ticketTierDto: AddTicketTierDto = {
    name: 'VIP',
    price: '200000',
    totalNumberOfTickets: '3',
    discount: true,
    discountExpiration: '2025-01-30T00:00:00Z',
    numberOfDiscountTickets: '1',
    discountPrice: '150000'
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    // Creating and initializing Nest application
    const app = moduleRef.createNestApplication();

    // Database teardown logic before running tests
    prisma = app.get(DbService)
    await prisma.cleanDb();

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

    event = await prisma.event.create({
      data: {
        title: 'Test Event',
        description: 'This is a test event',
        category: 'ENTERTAINMENT',
        capacity: 20000,
        address: 'Asaba',
        venue: 'Shoprite',
        date: '2025-01-31T00:00:00Z',
        endTime: '2025-01-31T22:00:00Z',
        startTime: '2025-01-31T17:00:00Z',
        revenue: 0,
        ageRestriction: 30,
        poster: 'poster-image-link',
        organizer: {
          create: {
            accountName: Secrets.ACCOUNT_NAME,
            accountNumber: Secrets.ACCOUNT_NUMBER,
            bankName: Secrets.BANK_NAME,
            recipientCode: 'RCP_wocnj2ow',
            email: 'organizer@example.com',
            name: 'Test Organizer',
            phone: '9876543210',
            userId: user.id
          }
        }
      }
    });

    ticket = await prisma.ticket.create({
      data: {
        price: +ticketTierDto.price,
        accessKey: 'Access Key',
        tier: ticketTierDto.name,
        attendee: user.id,
        eventId: event.id
      }
    });
  });

  describe('Add Ticket Tier', () => {
    it('should create ticket tier', async () => {
      await ticketService.addTicketTier(ticketTierDto, event.id);
    });

    it('should create ticket tier without discount offer', async () => {
      await ticketService.addTicketTier({
        ...ticketTierDto,
        name: 'Regular',
        discount: false
      }, event.id);
    });

    it('should throw if a ticket tier already exists with given name', async () => {
      await expect(ticketService.addTicketTier(ticketTierDto, event.id))
        .rejects.toThrow(`A ticket tier named ${ticketTierDto.name} has already been added to this event`);
    });
  });

  describe('Remove Discount Offer', () => {
    it('should throw if no ticket tier exists with given name', async () => {
      const tier = 'Wrong Tier Name'
      await expect(ticketService.removeDiscount(event.id, `${tier}`))
        .rejects.toThrow(`No ticket tier named ${tier} in this event`);
    });

    it('should throw if no discount offer is available in ticket tier', async () => {
      await expect(ticketService.removeDiscount(event.id, 'Regular'))
        .rejects.toThrow('No discount offer available in this tier');
    });

    it('should remove discount offer from ticket tier', async () => {
      await ticketService.removeDiscount(event.id, ticketTierDto.name);
    });
  });

  describe('Purchase Ticket', () => {
    const dto: PurchaseTicketDto = {
      tier: ticketTierDto.name,
      quantity: 5
    };

    it('should throw if user is restricted by age from attending event', async () => {
      await expect(ticketService.purchaseTicket(dto, event.id, user.id))
        .rejects.toThrow(`You must be at least ${event.ageRestriction} years old to attend this event`);
    });

    it('should throw if there are insufficient tickets in given tier', async () => {
      event = await prisma.event.update({
        where: { id: event.id },
        data: { ageRestriction: 18 }
      });

      await expect(ticketService.purchaseTicket(dto, event.id, user.id))
        .rejects.toThrow(`Insufficient ${dto.tier} tickets. Check out other ticket tiers`);
    });

    it('should return Paystack checkout link', async () => {
      await ticketService.purchaseTicket({
        ...dto,
        quantity: 1
      }, event.id, user.id);
    }, 30000);
  });

  describe('Validate Ticket', () => {
    const dto: ValidateTicketDto = {
      accessKey: 'Access Key'
    };

    it('should validate ticket', async () => {
      await ticketService.validateTicket(dto, event.id);
    });

    it('should throw if ticket has already been used', async () => {
      await expect(ticketService.validateTicket(dto, event.id))
        .rejects.toThrow('This ticket has already been used');
    });

    it('should throw if access key is invalid', async () => {
      await expect(ticketService.validateTicket({ accessKey: 'Invalid access key' }, event.id))
        .rejects.toThrow('Invalid QRcode or access key');
    });
  });
})