import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import logger from "../common/logger";
import { DbService } from "../db/db.service";
import { PaymentsService } from "../payments/payments.service";
import { sendEmail } from "../common/config/mail";

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

          // Remove the organizer as a transfer recipient when the event is complete
          await this.payments.deleteTransferRecipient(event.organizer.recipientCode);
        } else if (event.ticketTiers.every(tier => tier.soldOut === true)) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { status: "SOLD_OUT" }
          });

          // Notify the event organizer of the event's sold out status
          const subject = 'SOLD OUT!'
          const content = `Congratulations, your event titled: ${event.title} is sold out!`
          await sendEmail(event.organizer, subject, content);
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
}
