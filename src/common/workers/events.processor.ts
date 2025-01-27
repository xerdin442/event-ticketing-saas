import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { RedisClientType } from "redis";
import { initializeRedis } from "../config/redis-conf";
import { Secrets } from "../env";
import logger from "../logger";
import { sendEmail } from "../config/mail";
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
    const { longitude, latitude, eventId } = job.data;

    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Geolocation Search',
      Secrets.GEOLOCATION_STORE_INDEX,
    );

    try {
      await redis.geoAdd('events', [
        { longitude, latitude, member: `ID:${eventId}` }
      ]);

      logger.info(`[${this.context}] Location coordinates added to Redis store.\n`)
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
        ${event.organizer.name}
        `
  
        if (event.users.length > 0) {
          for (const user of event.users) {
            await sendEmail(user, subject, content);
          }

          return;
        }

        return;
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
      await this.prisma.ticket.updateMany({
        where: { eventId: event.id },
        data: { status: "CANCELLED" }
      });

      // Remove organizer as a transfer recipient after event cancellation
      await this.payments.deleteTransferRecipient(event.organizer.recipientCode);

      if (event.users.length > 0) {
        for (let user of event.users) {
          // Send email to attendees to inform them of the cancellation
          const subject = 'Event Cancellation'
          const content = `The event: ${event.title} has been cancelled. We sincerely apologize for any inconveniences
          caused by this cancellation. A refund for your tickets has been initiated. Thanks for your patience.
          
          Best regards,
          ${event.organizer.name}`;
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
          const refund = tickets.reduce((total, ticket) => {
            return total + (ticket.discountPrice ? ticket.discountPrice : ticket.price) * 100;
          }, 0);
  
          // Initiate transfer of ticket refund
          // await this.payments.initiateTransfer(
          //   recipientCode,
          //   refund,
          //   'Ticket Refund',
          //   {
          //     userId: user.id,
          //     eventTitle: event.title,
          //     retryKey: randomUUID().replace(/-/g, '')
          //   }
          // );
        }
      }

      logger.info(`[${this.context}] Event cancellation process completed for ${event.title}.\n`);
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while completing event cancellation process. Error: ${error.message}.\n`);
      throw error;
    }
  }

  @Process('ongoing-status-update')
  async updateOngoingEvents(job: Job) {
    try {
      await this.prisma.event.update({
        where: { id: job.data.eventId },
        data: { status: "ONGOING" }
      });      
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ongoing event status update. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('completed-status-update')
  async updateCompletedEvents(job: Job) {
    try {
      await this.prisma.event.update({
        where: { id: job.data.eventId },
        data: { status: "COMPLETED" }
      });      
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing completed event status update. Error: ${error.message}\n`);
      throw error;
    }
  }
}