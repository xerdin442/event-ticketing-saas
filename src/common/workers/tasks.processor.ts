import { Injectable } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import logger from "../logger";
import { DbService } from "../../db/db.service";

@Injectable()
@Processor('tasks-queue')
export class TasksProcessor {
  private context = TasksProcessor.name

  constructor(private readonly prisma: DbService) { };

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
