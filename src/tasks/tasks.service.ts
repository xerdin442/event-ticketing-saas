import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "../common/logger";
import { DbService } from "../db/db.service";
import { PaymentsService } from "../payments/payments.service";
import { sendEmail } from "../common/config/mail";
import { RedisClientType } from "redis";
import { initializeRedis } from "../common/config/redis-conf";
import { Secrets } from "../common/env";
import { EmailAttachment, FailedTransfer } from "../common/types";
import { deleteFile, generateFailedTransferRecords } from "../common/util/document";
import { randomUUID } from "crypto";

@Injectable()
export class TasksService {
  private readonly context: string = TasksService.name;

  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService
  ) { };

  @Cron("0 */15 * * * *")
  async updateEventStatus(): Promise<void> {
    try {
      // Get all events excluding completed or cancelled events
      const events = await this.prisma.event.findMany({
        where: {
          NOT: [
            { status: "CANCELLED" },
            { status: "COMPLETED" },
          ]
        },
        include: {
          ticketTiers: true,
          organizer: true
        }
      });

      for (let event of events) {
        const currentTime = new Date().getTime();
        const startTime = new Date(event.startTime).getTime();
        const endTime = new Date(event.endTime).getTime();

        if (currentTime > startTime && currentTime < endTime) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { status: "ONGOING" }
          });
        } else if (currentTime > endTime) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { status: "COMPLETED" }
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
        } else if (event.ticketTiers.every(tier => tier.soldOut === true)) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { status: "SOLD_OUT" }
          });

          // Notify the event organizer of the event's sold out status
          const subject = 'SOLD OUT!'
          const content = `Congratulations, your event titled: ${event.title} is sold out!`
          await sendEmail(event.organizer, subject, content);

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
        }
      };

      logger.info(`[${this.context}] Status of all events updated successfully.\n`);
      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while updating event status. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Cron("0 */15 * * * *")
  async checkDiscountExpiration(): Promise<void> {
    try {
      // Get all events and their ticket tiers
      const events = await this.prisma.event.findMany({
        include: { ticketTiers: true }
      });

      for (let event of events) {
        event.ticketTiers.forEach(async (tier) => {
          const currentTime = new Date().getTime();
          const expirationDate = new Date(tier.discountExpiration).getTime();

          // Update discount status if the expiration time has elapsed
          if (currentTime > expirationDate) {
            await this.prisma.ticketTier.update({
              where: { id: tier.id },
              data: { discountStatus: "ENDED" }
            });
          };
        })
      };

      logger.info(`[${this.context}] Discount status of event tickets updated successfully.\n`);
      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while updating discount status of event tickets. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processFailedTransfers(): Promise<void> {
    let record: EmailAttachment;
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Transfer Management',
      Secrets.FAILED_TRANSFERS_STORE_INDEX
    );

    try {
      const keys = await redis.keys('*');
      if (keys) {
        // Extract the transfer details for each user email
        const transfers: FailedTransfer[] = await Promise.all(
          keys.map(async (key) => {
            const value = await redis.get(key);
            return { email: key, details: JSON.parse(value) };
          })
        );

        record = await generateFailedTransferRecords(transfers);
        const subject = 'Failed Transfers'
        const content = 'Hello, these are failed transfers that occured in the past 24 hours. The details are attached to this email.'
        await sendEmail(Secrets.APP_EMAIL, subject, content, [record]);

        logger.info(`[${this.context}] Details of failed transfers sent to platform email for further processing.\n`);
        return;
      }

      logger.info(`[${this.context}] No failed transfers found.\n`);
      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred during daily processing of failed transfers. Error: ${error.message}\n`);
      throw error;
    } finally {
      if (record) await deleteFile(record.content);
      await redis.disconnect();
    }
  }
}
