import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { RedisClientType } from "redis";
import { initializeRedis } from "../config/redis-conf";
import { Secrets } from "../env";
import logger from "../logger";
import { MailService } from "../config/mail";
import { DbService } from "@src/db/db.service";
import { PaymentsService } from "@src/payments/payments.service";
import { MetricsService } from "@src/metrics/metrics.service";
import { Ticket } from "@prisma/client";
import { TicketRefundInfo } from "../types";
import { formatDate } from "../util/helper";

@Injectable()
@Processor('events-queue')
export class EventsProcessor {
  private readonly context: string = EventsProcessor.name;

  constructor(
    private readonly prisma: DbService,
    private readonly metrics: MetricsService,
    private readonly payments: PaymentsService,
    private readonly mailService: MailService,
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
      redis.destroy();
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
        Time: ${formatDate(event.startTime, 'time')} - ${formatDate(event.endTime, 'time')}
        Date: ${formatDate(event.date, 'date')}
  
        We sincerely apologize for any inconveniences caused by these changes.
  
        Best regards,
        ${event.organizer.name}
        `

      // Notify all attendees of the event update
      if (event.tickets.length > 0) {
        const attendees: string[] = [];
        event.tickets.forEach((ticket: Ticket) => attendees.push(ticket.attendee));

        for (let attendee of [...new Set(attendees)]) {
          await this.mailService.sendEmail(attendee, subject, content);
        }
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
      await this.prisma.ticket.updateMany({
        where: { eventId: event.id },
        data: { status: "CANCELLED" }
      });

      // Update metrics value
      this.metrics.incrementCounter('total_events', ['cancelled']);

      if (event.tickets.length > 0) {
        const attendees: string[] = [];
        event.tickets.forEach((ticket: Ticket) => attendees.push(ticket.attendee));

        const subject = 'Event Cancellation'
        const content = `The event: ${event.title} has been cancelled. We sincerely apologize for any inconveniences
          caused by this cancellation. You can initiate a ticket refund here: .

          Best regards,
          ${event.organizer.name}`;

        // Notify all attendees of the event cancellation
        for (let attendee of [...new Set(attendees)]) {
          await this.mailService.sendEmail(attendee, subject, content);
        }
      }

      logger.info(`[${this.context}] Event cancellation process completed for ${event.title}.\n`);
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while processing event cancellation. Error: ${error.message}.\n`);
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
      logger.error(`[${this.context}] An error occured while processing ONGOING event status update. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('completed-status-update')
  async updateCompletedEvents(job: Job) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: job.data.eventId },
        include: { organizer: true }
      });

      // Mark event as complete
      await this.prisma.event.update({
        where: { id: event.id },
        data: { status: "COMPLETED" }
      });

      // Intitiate transfer of revenue split to event orgnaizer
      if (!Secrets.PAYSTACK_SECRET_KEY.includes('test')) {
        await this.payments.initiateTransfer(
          event.organizer.recipientCode,
          event.revenue * 100,
          'Revenue Split',
          {
            email: event.organizer.email,
            eventTitle: event.title,
          }
        );

      }

      // Update metrics value
      this.metrics.incrementCounter('total_events', ['completed']);
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing COMPLETED event status update. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('ticket-refund-otp')
  async sendTicketRefundOtp(job: Job) {
    // Initialize Redis connection
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Ticket Refund',
      Secrets.TICKET_REFUND_STORE_INDEX,
    );

    try {
      const otp = `${Math.random() * 10 ** 16}`.slice(3, 9);
      const content = `Here's the OTP to verify your ticket refund request: ${otp}
        This code is only valid for the next 10 minutes.`;

      // Send verification mail to attendee
      await this.mailService.sendEmail(job.data.email, 'Ticket Refund Verification', content);

      // Cache the OTP for the next 10mins
      const refundInfo: TicketRefundInfo = { ...job.data, otp };
      await redis.setEx(job.data.requestId, 600, JSON.stringify(refundInfo));

      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while sending verification mail for ticket refund. Error: ${error.message}.\n`);
      throw error;
    } finally {
      redis.destroy();
    }
  }

  @Process('event-alerts')
  async sendEventAlerts(job: Job) {
    try {
      const { users, eventId } = job.data;

      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { organizer: true }
      });

      const subject = 'NEW EVENT ALERT!'
      const content = `A new ${event.category.toLowerCase()} event is coming up soon! Here are the details:\n
        Title: ${event.title}
        Venue: ${event.venue}
        Address: ${event.address}
        Date: ${event.date}
        Time: ${event.startTime} - ${event.endTime}

        Get your tickets here: 

        Best regards,
        The ${Secrets.APP_NAME} team
        `;

      for (let user of users) {
        await this.mailService.sendEmail(user.email, subject, content);
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while sending event alerts. Error: ${error.message}.\n`);
      throw error;
    }
  }
}