import { Test } from "@nestjs/testing";
import { AppModule } from "@src/app.module";
import { DbService } from "@src/db/db.service";
import { Secrets } from "@src/common/env";
import { Event, User } from "@prisma/client";
import { EventsService } from "@src/events/events.service";
import {
  CreateEventDto,
  NearbyEventsDto,
  UpdateEventDto
} from "@src/events/dto";

describe('Event Service', () => {
  let prisma: DbService;
  let eventService: EventsService;
  let user: User;
  let event: Event;

  beforeAll(async () => {
    jest.useRealTimers();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    // Creating and initializing Nest application
    const app = moduleRef.createNestApplication();

    // Database teardown logic before running tests
    prisma = app.get(DbService)
    await prisma.cleanDb();

    eventService = app.get(EventsService);

    user = await prisma.user.create({
      data: {
        email: 'event@example.com',
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

  describe('Create Event', () => {
    const dto: CreateEventDto = {
      title: 'Test Event',
      description: 'This is a test event',
      category: 'ENTERTAINMENT',
      capacity: '20000',
      address: 'Asaba',
      venue: 'Shoprite',
      date: '2025-02-01T00:00:00Z',
      endTime: '2025-02-01T22:00:00Z',
      startTime: '2025-02-01T17:00:00Z'
    };

    it('should throw if the user has no organizer profile', async () => {
      await expect(eventService.createEvent(dto, user.id, 'event-poster-link'))
        .rejects.toThrow('An organizer profile is required to create an event');
    }, 30000);

    it('should throw if coordinates cannot be generated from event location', async () => {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          organizer: {
            create: {
              accountName: Secrets.ACCOUNT_NAME,
              accountNumber: Secrets.ACCOUNT_NUMBER,
              bankName: Secrets.BANK_NAME,
              recipientCode: 'RCP_wocnj2ow',
              email: 'organizer@example.com',
              name: 'Test Organizer',
              phone: '9876543210'
            }
          }
        }
      });

      await expect(eventService.createEvent(
        {
          ...dto,
          address: 'Address',
          venue: 'Venue',
        },
        user.id,
        'event-poster-link'
      ))
        .rejects.toThrow('Failed to generate coordinates for the event location. Please enter correct values for "venue" and "address"');
    }, 30000);

    it('should create new event', async () => {
      event = await eventService.createEvent(dto, user.id, 'event-poster-link');
    }, 30000);
  });

  describe('Update Event', () => {
    const dto: UpdateEventDto = {
      description: 'Updated test event description'
    };

    it('should update event by ID', async () => {
      await eventService.updateEvent(dto, event.id);
    }, 30000)
  });

  describe('Event Details', () => {
    it('should return event details by ID', async () => {
      await eventService.getEventDetails(event.id);
    })
  });

  describe('Nearby Events', () => {
    const dto: NearbyEventsDto = {
      latitude: "6.21407043245160651",
      longitude: "6.70151799917221069"
    };
    
    it('should return all nearby events', async () => {
      await eventService.findNearbyEvents(dto);
    }, 30000);
  });

  describe('Cancel Event', () => {
    it('should cancel event by ID', async () => {
      await eventService.cancelEvent(event.id);
    })
  })
})