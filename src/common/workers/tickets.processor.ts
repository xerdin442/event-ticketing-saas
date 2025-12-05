import { Injectable } from "@nestjs/common";
import { Process, Processor } from "@nestjs/bull";
import { Job } from "bull";
import logger from "../logger";
import { DbService } from "@src/db/db.service";
import { TicketLockInfo } from "../types";
import { MailService } from "../config/mail";

@Injectable()
@Processor('tickets-queue')
export class TicketsProcessor {
  private readonly context: string = TicketsProcessor.name;

  constructor(
    private readonly prisma: DbService,
    private readonly mailService: MailService,
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

  @Process('ticket-status-update')
  async updateTicketStatus(job: Job): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUniqueOrThrow({
        where: { id: job.data.ticketId },
        include: { event: true }
      });

      // Mark ticket as expired if event has ended and status is still active or pending resale
      const dateExpirationCheck: boolean = new Date(ticket.event.endTime).getTime() < new Date().getTime();
      const expiryCondition: boolean = (ticket.status === 'ACTIVE' || ticket.status === 'PENDING_RESALE') && dateExpirationCheck;
      if (expiryCondition) {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: "EXPIRED" }
        });
      }

      if (ticket.status === 'PENDING_RESALE') {
        // Remove ticket listing from resale marketplace
        await this.prisma.listing.delete({
          where: { ticketId: ticket.id }
        });

        // Inform user of ticket expiration and removal of resale listing
        const content = `Your ticket for ${ticket.event.title.toUpperCase()} has expired and the resale listing has been removed from the marketplace.`;
        await this.mailService.sendEmail(ticket.attendee, 'Ticket Expiration', content);
      }

      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ticket status update. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('ticket-unlock')
  async processTicketUnlock(job: Job<TicketLockInfo>): Promise<void> {
    try {
      const { discount, numberOfTickets, tierId } = job.data;

      // Update number of available tickets
      await this.prisma.ticketTier.update({
        where: { id: tierId },
        data: {
          numberOfDiscountTickets: (discount && { increment: numberOfTickets }),
          totalNumberOfTickets: { increment: numberOfTickets }
        }
      });

      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ticket unlock after purchase window. Error: ${error.message}\n`);
      throw error;
    }
  }
}
