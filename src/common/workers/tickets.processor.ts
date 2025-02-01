import { Injectable } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import logger from "../logger";
import { DbService } from "@src/db/db.service";

@Injectable()
@Processor('tickets-queue')
export class TicketsProcessor {
  private context = TicketsProcessor.name

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
}
