import { Injectable } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import logger from "../logger";
import { DbService } from "@src/db/db.service";
import { TicketLockInfo } from "../types";
import { RedisClientType } from "redis";
import { initializeRedis } from "../config/redis-conf";
import { Secrets } from "../env";

@Injectable()
@Processor('tickets-queue')
export class TicketsProcessor {
  private readonly context: string = TicketsProcessor.name;
  private redis: RedisClientType;

  constructor(private readonly prisma: DbService) { };

  @Process('discount-status-update')
  async updateDiscountExpiration(job: Job) {
    try {
      await this.prisma.ticketTier.update({
        where: { id: job.data.tierId },
        data: { discountStatus: "ENDED" }
      });
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing discount status update. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('ticket-lock')
  async unlockTickets(job: Job): Promise<void> {
    try {
      // Initialize Redis store to check ticket lock status
      this.redis = await initializeRedis(
        Secrets.REDIS_URL,
        'Ticket Lock',
        Secrets.TICKET_LOCK_STORE_INDEX,
      );
      const { lockId } = job.data;

      // Get ticket lock data
      const rawLockData = await this.redis.get(lockId) as string;
      const parsedLockData = JSON.parse(rawLockData) as TicketLockInfo;
      const { discount, numberOfTickets, tierId, status } = parsedLockData;

      // Check lock status
      if (status === 'unlocked') {
        // Unlock tickets and add them to the ticket pool
        await this.prisma.ticketTier.update({
          where: { id: tierId },
          data: {
            numberOfDiscountTickets: (discount && { increment: numberOfTickets }),
            totalNumberOfTickets: { increment: numberOfTickets }
          }
        });
      }

      // Delete ticket lock data from cache
      await this.redis.del(lockId);

      return;
    } catch (error) {
      throw error;
    } finally {
      this.redis.destroy();
    }
  }
}
