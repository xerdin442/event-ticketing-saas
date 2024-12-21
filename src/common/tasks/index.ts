import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "../logger";

@Injectable()
export class TaskService {
  private readonly context: string = TaskService.name;

  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateEventStatus() {
    try {
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while updating event status. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkDiscountExpiration() {
    try {
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while checking discount expiration for event tickets. Error: ${error.message}\n`);
      throw error;
    }
  }
}