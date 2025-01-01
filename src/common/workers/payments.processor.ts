import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { PaymentsGateway } from "../../payments/payments.gateway";
import { DbService } from "../../db/db.service";
import { PaymentsService } from "src/payments/payments.service";
import { randomUUID } from "crypto";
import * as qrcode from "qrcode";
import { sendEmail } from "../config/mail";
import logger from "../logger";
import { initializeRedis } from "../config/redis-conf";
import { Secrets } from "../env";
import { generateTicketPDF } from "../util/document";
import { EmailAttachment } from "../types";

@Injectable()
@Processor('payments-queue')
export class PaymentsProcessor {
  private readonly context: string = PaymentsProcessor.name;

  constructor(
    private readonly gateway: PaymentsGateway,
    private readonly prisma: DbService,
    private readonly payments: PaymentsService
  ) { };

  @Process('transaction')
  async finalizeTransaction(job: Job) {
    try {
      const { eventType, metadata } = job.data;
      const { userId, eventId, discount, ticketTier, amount, quantity } = metadata;

      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          ticketTiers: true,
          organizer: true
        }
      });
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      let split: number;
      let price: number;
      let pdfs: EmailAttachment[] = [];

      if (eventType === 'charge.success') {
        // Notify the client of payment status via WebSocket connection
        this.gateway.sendPaymentStatus(user.email, 'success', 'Payment successful!');

        for (let tier of event.ticketTiers) {
          if (tier.name === ticketTier) {
            price = tier.price;

            // Check the number of discount tickets left and update status of the discount offer
            if (tier.numberOfDiscountTickets === 0) {
              await this.prisma.ticketTier.update({
                where: { id: tier.id },
                data: { discountStatus: "ENDED" }
              });
            };

            // Check the total number of tickets left and update status of the ticket tier
            if (tier.totalNumberOfTickets === 0) {
              await this.prisma.ticketTier.update({
                where: { id: tier.id },
                data: { soldOut: true }
              });
            };

            // Calculate and subtract the platform fee from transaction amount based on ticket price
            if (price <= 20000) {
              split = amount * 0.925;
            } else if (price > 20000 && price <= 100000) {
              split = amount * 0.95;
            } else if (price > 100000) {
              split = amount * 0.975;
            }
          }
        }

        // Intitiate transfer of event organizer's split
        await this.payments.initiateTransfer(
          event.organizer.recipientCode,
          split * 100,
          'Revenue Split',
          {
            userId,
            eventTitle: event.title,
            retryKey: randomUUID().replace(/-/g, '')
          }
        );

        // Add the organizer's split to the event's total revenue and the user to the attendee list
        await this.prisma.event.update({
          where: { id: eventId },
          data: {
            revenue: { increment: split },
            users: {
              connect: { id: userId }
            }
          }
        });

        // Create the required number of tickets
        for (let i = 1; i <= quantity; i++) {
          const accessKey = randomUUID().split('-')[4]
          const qrcodeImage = await qrcode.toDataURL(accessKey, { errorCorrectionLevel: 'H' })

          const ticket = await this.prisma.ticket.create({
            data: {
              accessKey,
              price,
              tier: ticketTier,
              attendee: userId,
              eventId
            },
            include: {
              user: true,
              event: true
            }
          });

          // Generate ticket PDF and configure email attachment
          const ticketPDF = await generateTicketPDF(ticket, qrcodeImage, ticket.user, ticket.event);
          pdfs.push(ticketPDF);
        };
        
        // Send an email with the ticket PDFs to the attendee
        const subject = 'Ticket Purchase'
        const content = `You are purchased a ticket for the event: ${event.title}.
          Attached to this email are your ticket(s). They'll be required for entry at the event, keep them safe!`
        await sendEmail(user, subject, content, pdfs);

        logger.info(`[${this.context}] Ticket purchase completed by ${user.email}.\n`);
        return;
      } else if (eventType === 'charge.failed') {
        // Notify the client of payment status via WebSocket connection
        this.gateway.sendPaymentStatus(user.email, 'failed', 'Payment unsuccessful!');

        // Update details of ticket tier if ticket purchase failed
        for (let tier of event.ticketTiers) {
          if (tier.name === ticketTier) {
            if (discount) {
              // Update number of discount tickets if it was a discount purchase
              await this.prisma.ticketTier.update({
                where: { id: tier.id },
                data: { numberOfDiscountTickets: { increment: quantity } }
              });
            }

            // Update total number of tickets in the tier
            await this.prisma.ticketTier.update({
              where: { id: tier.id },
              data: { totalNumberOfTickets: { increment: quantity } }
            });
          }
        };

        logger.info(`[${this.context}] Ticket purchase failed: Email: ${user.email}\n`);
        return;
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ticket purchase, Job ID: ${job.id}. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('transfer')
  async finalizeTransfer(job: Job) {
    const { eventType, metadata, reason, recipientCode, amount } = job.data;
    const { userId, eventTitle, retryKey } = metadata;

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    try {
      if (eventType === 'transfer.success') {
        if (reason === 'Ticket Refund') {
          // Remove the attendee as a transfer recipient after the refund is complete
          await this.payments.deleteTransferRecipient(recipientCode);

          // Notify the attendee of the ticket refund
          const content = `Ticket refund has been completed for the cancelled event: ${eventTitle}. Thank you for your patience.`;
          await sendEmail(user, reason, content);
        }

        logger.info(`[${this.context}] ${reason}: Transfer to ${user.email} was successful!\n`)
        return;
      } else if (eventType === 'transfer.failed') {
        logger.info(`[${this.context}] ${reason}: Transfer to ${user.email} failed!\n`)
        return;
      } else if (eventType === 'transfer.reversed') {
        logger.info(`[${this.context}] ${reason}: Transfer to ${user.email} has been reversed.\n`)

        // Initialize Redis instance for storing number of transfer retries
        const redis = await initializeRedis(
          Secrets.REDIS_URL,
          Secrets.TRANSFER_RETRIES_STORE_INDEX,
          'Transfer Retries'
        );

        /* Use the retry key to check if the transfer has already been retried.
        If not, retry the transfer after 20mins and store the status of the retry key */
        const checkRetry = await redis.get(retryKey);
        if (checkRetry) {
          logger.info(`[${this.context}] ${reason}: Transfer retry already attempted for ${user.email}.`);
          return;
        } else {
          setTimeout(async () => {
            try {
              await this.payments.initiateTransfer(recipientCode, amount, reason, metadata);
              await redis.setEx(retryKey, 86400, JSON.stringify({ status: 'USED' }));    

              logger.info(`[${this.context}] ${reason}: Transfer retry to ${user.email} has been successfully initiated.\n`);
              return;
            } catch (error) {
              throw error;
            } finally {
              await redis.disconnect();
            }
          }, 20 * 60 * 1000);
        }
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ${reason} transfer to ${user.email}. Error: ${error.message}\n`);
      throw error;
    }
  }
}