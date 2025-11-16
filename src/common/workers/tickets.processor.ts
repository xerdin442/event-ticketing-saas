import { Inject, Injectable } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import logger from "../logger";
import { DbService } from "@src/db/db.service";
import { TicketLockInfo } from "../types";
import { REDIS_CLIENT } from "@src/redis/redis.module";
import { RedisClientType } from "redis";

@Injectable()
@Processor('tickets-queue')
export class TicketsProcessor {
  private readonly context: string = TicketsProcessor.name;

  constructor(
    private readonly prisma: DbService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) { }

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
  async processTicketUnlock(job: Job): Promise<void> {
    try {
      const { lockId, discount, numberOfTickets, tierId } = job.data;
      const cacheKey = `ticket_lock:${lockId}`;
      const cacheResult = await this.redis.get(cacheKey) as string;

      const unlockTickets = async () => {
        await this.prisma.ticketTier.update({
          where: { id: tierId },
          data: {
            numberOfDiscountTickets: (discount && { increment: numberOfTickets }),
            totalNumberOfTickets: { increment: numberOfTickets }
          }
        });
      }

      // Purchase window has expired before payment
      if (!cacheResult) {
        await unlockTickets();
        return;
      }

      const lockData = JSON.parse(cacheResult) as TicketLockInfo;
      const { status } = lockData;

      if (status === "paid") {
        // Clear cache if payment was completed within purchase window
        await this.redis.del(cacheKey);
      } else {
        // Purchase window has expired but there's delay in cache cleanup
        await unlockTickets();
        await this.redis.del(cacheKey);
      }

      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ticket unlock after purchase window. Error: ${error.message}\n`);
      throw error;
    }
  }
}
