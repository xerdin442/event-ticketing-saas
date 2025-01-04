import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { RedisClientType } from "redis";
import { initializeRedis } from "../config/redis-conf";
import { Secrets } from "../env";
import logger from "../logger";
import { sendEmail } from "../config/mail";
import { Ticket } from "@prisma/client";
import { DbService } from "../../db/db.service";
import { PaymentsService } from "../../payments/payments.service";
import { randomUUID } from "crypto";

@Injectable()
@Processor('events-queue')
export class EventsProcessor {
  private readonly context: string = EventsProcessor.name;

  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService
  ) { };

  @Process('geolocation-store')
  async addToGeolocationStore(job: Job) {
    const { longitude, latitude, event } = job.data;

    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Geolocation Search',
      Secrets.GEOLOCATION_STORE_INDEX,
    );

    try {
      await redis.geoAdd('events', [
        { longitude, latitude, member: `${event.title}-${event.id}` }
      ]);

      logger.info(`[${this.context}] Location coordinates added to Redis store. Event: ${event.title}.\n`)
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while adding location coordinates to Redis store. Error: ${error.message}.\n`)
      throw error;
    } finally {
      await redis.disconnect();
    };
  }

  @Process('event-update')
  async updateEvent(job: Job) {
    try {
      const { event } = job.data;
      const subject = 'Event Update'
      const content = `Hello, there has been a change in the details of the event: ${event.title}
        Venue: ${event.venue}
        Address: ${event.address}
        Time: ${event.startTime} - ${event.endTime}
        Date: ${event.date}
  
        We sincerely apologize for any inconveniences caused by these changes.
  
        Best regards,
        ${event.organizer.name.join(' X ')}
        `
  
      for (const user of event.users) {
        await sendEmail(user, subject, content);
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while completing update of event details. Error: ${error.message}.\n`)
      throw error;
    }
  }

  @Process('cancel-event')
  async cancelEvent(job: Job) {
    try {
      const { event } = job.data;

      // Update the status of all the tickets for this event
      event.tickets.forEach(async (ticket: Ticket) => {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: "CANCELLED" }
        })
      });

      for (let user of event.users) {
        // Send email to attendees to inform them of the cancellation
        const subject = 'Event Cancellation'
        const content = `The event: ${event.title} has been cancelled. We sincerely apologize for any inconveniences
        caused by this cancellation. A refund for your tickets has been initiated. Thanks for your patience.
        
        Best regards,
        ${event.organizer.name.join(' X ')}`;
        await sendEmail(user, subject, content);

        // Create a transfer recipient for the attendee to receive the refund
        const recipientCode = await this.payments.createTransferRecipient({
          accountName: user.accountName,
          accountNumber: user.accountNumber,
          bankName: user.bankName
        });

        // Get user tickets for this event
        const tickets = await this.prisma.ticket.findMany({
          where: {
            eventId: event.id,
            attendee: user.id
          }
        });

        // Calculate the refund amount in kobo
        let refund: number = 0;
        tickets.forEach(ticket => {
          if (ticket.discountPrice) {
            refund += ticket.discountPrice * 100
          } else {
            refund += ticket.price * 100
          }
        });

        // Initiate transfer of ticket refund
        await this.payments.initiateTransfer(
          recipientCode,
          refund,
          'Ticket Refund',
          {
            userId: user.id,
            eventTitle: event.title,
            retryKey: randomUUID().replace(/-/g, '')
          }
        );
      }

      logger.info(`[${this.context}] Event cancellation process completed for ${event.title}.\n`);
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while completing event cancellation process. Error: ${error.message}.\n`);
      throw error;
    }
  }
}