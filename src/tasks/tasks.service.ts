import { Injectable } from "@nestjs/common";
import {
  Cron,
  CronExpression,
  SchedulerRegistry
} from "@nestjs/schedule";
import logger from "../common/logger";
import { DbService } from "../db/db.service";
import { PaymentsService } from "../payments/payments.service";
import { sendEmail } from "../common/config/mail";
import { RedisClientType } from "redis";
import { initializeRedis } from "../common/config/redis-conf";
import { Secrets } from "../common/env";
import { EmailAttachment, FailedTransfer } from "../common/types";
import { generateFailedTransferRecords } from "../common/util/document";
import { randomUUID } from "crypto";

@Injectable()
export class TasksService {
  private readonly context: string = TasksService.name;

  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
    private readonly scheduler: SchedulerRegistry
  ) { };

  updateOngoingEvents(eventId: number, name: string, timeout: number): void {
    const ongoingUpdate = setTimeout(async () => {
      try {
        await this.prisma.event.update({
          where: { id: eventId },
          data: { status: "ONGOING" }
        });
      } catch (error) {
        logger.error(`[${this.context}] An error occurred while updating event status. Error: ${error.message}\n`);
        throw error;
      }
    }, timeout);
    this.scheduler.addTimeout(name, ongoingUpdate);

    return;
  }

  updateCompletedEvents(eventId: number, name: string, timeout: number): void {
    const completedUpdate = setTimeout(async () => {
      try {
        const event = await this.prisma.event.update({
          where: { id: eventId },
          data: { status: "COMPLETED" },
          include: { organizer: true }
        });

        // Intitiate transfer of the event revenue
        await this.payments.initiateTransfer(
          event.organizer.recipientCode,
          event.revenue * 100,
          'Revenue Split',
          {
            userId: event.organizer.userId,
            eventTitle: event.title,
            retryKey: randomUUID().replace(/-/g, '')
          }
        );
      } catch (error) {
        logger.error(`[${this.context}] An error occurred while updating event status. Error: ${error.message}\n`);
        throw error;
      }
    }, timeout);
    this.scheduler.addTimeout(name, completedUpdate);

    return;
  }

  updateDiscountExpiration(tierId: number, name: string, timeout: number): void {
    const disountUpdate = setTimeout(async () => {
      try {
        await this.prisma.ticketTier.update({
          where: { id: tierId },
          data: { discountStatus: "ENDED" }
        });
      } catch (error) {
        logger.error(`[${this.context}] An error occurred while updating discount status of event tickets. Error: ${error.message}\n`);
        throw error;        
      }
    }, timeout);
    this.scheduler.addTimeout(name, disountUpdate);

    return;
  }

  deleteTimeout(name: string): void {
    this.scheduler.deleteTimeout(name);
    return;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processFailedTransfers(): Promise<void> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Transfer Management',
      Secrets.FAILED_TRANSFERS_STORE_INDEX
    );

    try {
      const keys = await redis.keys('*');
      if (keys.length > 0) {
        // Extract the transfer details for each user email
        const transfers: FailedTransfer[] = await Promise.all(
          keys.map(async (key) => {
            const value = await redis.get(key);
            return { email: key, details: JSON.parse(value) };
          })
        );

        const record: EmailAttachment = await generateFailedTransferRecords(transfers);
        const subject = 'Failed Transfers'
        const content = 'Hello, these are failed transfers that occured in the past 24 hours. The details are attached to this email.'
        const receiver = { firstName: 'Admin', email: Secrets.ADMIN_EMAIL };
        await sendEmail(receiver, subject, content, [record]);

        logger.info(`[${this.context}] Details of failed transfers sent to platform email for further processing.\n`);
        return;
      }

      logger.info(`[${this.context}] No failed transfers found.\n`);
      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during daily processing of failed transfers. Error: ${error.message}\n`);
      throw error;
    } finally {
      await redis.disconnect();
    }
  }
}
