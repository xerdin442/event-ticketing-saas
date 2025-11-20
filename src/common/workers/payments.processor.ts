import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { PaymentsGateway } from "@src/payments/payments.gateway";
import { DbService } from "@src/db/db.service";
import { PaymentsService } from "@src/payments/payments.service";
import { randomUUID } from "crypto";
import * as qrcode from "qrcode";
import { MailService } from "../config/mail";
import logger from "../logger";
import { generateTicketPDF } from "../util/document";
import { MetricsService } from "@src/metrics/metrics.service";
import { Secrets } from "../secrets";
import { Attachment } from "resend";
import { RedisClientType } from "redis";
import { formatDate } from "../util/helper";
import { TicketLockInfo } from "../types";
import { TicketTier } from "@prisma/client";
import { notifyWhatsappBotServer } from "@src/whatsapp/webhooks";

@Injectable()
@Processor('payments-queue')
export class PaymentsProcessor {
  private readonly context: string = PaymentsProcessor.name;
  private redis: RedisClientType;

  constructor(
    private readonly gateway: PaymentsGateway,
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
    private readonly metrics: MetricsService,
    private readonly mailService: MailService,
  ) { };

  @Process('transaction')
  async finalizeTransaction(job: Job) {
    const { eventType, metadata, transactionReference } = job.data;
    const attendee = metadata.email as string;
    const lockId = metadata.lockId as string;
    const whatsappPhoneId = metadata?.whatsappPhoneId as string;

    const eventId = parseInt(metadata.eventId);
    const tierId = parseInt(metadata.tierId);
    const amount = parseInt(metadata.amount);
    const quantity = parseInt(metadata.quantity);

    let discount: boolean;
    metadata.discount === 'false' ? discount = false : discount = true;

    let trending: boolean;
    metadata.trending === 'false' ? trending = false : trending = true;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        ticketTiers: true,
        organizer: true
      }
    });
    const tier = event.ticketTiers.find(tier => tier.id === tierId);
    const price = tier.price;

    try {
      // Idempotent processing to skip transactions that have been settled
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference: transactionReference }
      });
      if (transaction && transaction.status !== "TX_PENDING") return;

      if (eventType === 'charge.success') {
        try {
          let updatedTier: TicketTier;

          if (trending) {
            // Get ticket lock data
            const cacheKey = `ticket_lock:${lockId}`;
            const cacheResult = await this.redis.get(cacheKey) as string;

            // Reject request if payment occurs after purchase window has expired
            if (!cacheResult) {
              // Update status of ticket lock
              await this.prisma.transaction.update({
                where: { reference: transactionReference },
                data: { lockStatus: "EXPIRED" }
              });

              throw new Error('Your purchase window has expired. Please restart the process');
            }

            // If payment occurs within the window, extend the TTL by 60 seconds so the queue job can process the ticket unlock
            const lockData = JSON.parse(cacheResult) as TicketLockInfo;
            await this.redis.setEx(
              cacheKey,
              60,
              JSON.stringify({ ...lockData, status: "paid" })
            );

            // Update status of ticket lock
            await this.prisma.transaction.update({
              where: { reference: transactionReference },
              data: { lockStatus: "PAID" }
            });
          } else {
            await this.prisma.$transaction(async (tx) => {
              const selectedTier = await this.prisma.ticketTier.findUnique({
                where: { id: tier.id },
              });

              // Check total number of tickets left
              if (selectedTier.totalNumberOfTickets < quantity) {
                throw new Error(`Insufficient ${selectedTier.name} tickets`);
              };

              if (discount) {
                // Check number of discount tickets left
                if (selectedTier.numberOfDiscountTickets < quantity) {
                  throw new Error(`Discount ${selectedTier.name} tickets are sold out! Please check other ticket tiers`);
                };

                // Check if the discount offer has expired
                const expirationDate = new Date(selectedTier.discountExpiration).getTime();
                if (Date.now() > expirationDate) {
                  throw new Error(`Discount offer for ${selectedTier.name} tickets has expired. Please check other ticket tiers`);
                };
              }

              // Update total number of tickets left in the tier
              updatedTier = await tx.ticketTier.update({
                where: { id: selectedTier.id },
                data: {
                  numberOfDiscountTickets: (discount && { decrement: quantity }),
                  totalNumberOfTickets: { decrement: quantity }
                }
              });
            });
          }

          // Check the number of discount tickets left and update status of the discount offer
          if (updatedTier.numberOfDiscountTickets === 0) {
            await this.prisma.ticketTier.update({
              where: { id: updatedTier.id },
              data: { discountStatus: "ENDED" }
            });
          };

          // Check the total number of tickets left and update status of the ticket tier
          if (updatedTier.totalNumberOfTickets === 0) {
            await this.prisma.ticketTier.update({
              where: { id: updatedTier.id },
              data: { soldOut: true }
            });
          };

          // Update transaction status
          await this.prisma.transaction.update({
            where: { reference: transactionReference },
            data: { status: "TX_SUCCESS" }
          });
        } catch (error) {
          // Update transaction status
          await this.prisma.transaction.update({
            where: { reference: transactionReference },
            data: { status: "REFUND_PENDING" }
          });

          // Initiate refund of transaction amount
          await this.payments.initiateRefund(transactionReference, {
            email: attendee,
            eventTitle: event.title,
            date: formatDate(new Date(), 'date'),
          });

          logger.warn(`[${this.context}] Ticket purchase unsuccessful. Transaction refund to ${attendee} initiated. Error: ${error.message}\n`);

          // Notify the user of the payment status
          return this.gateway.sendPaymentStatus(
            attendee,
            'refund',
            `Transaction unsuccessful: ${error.message}`
          );
        };

        // Calculate and subtract the platform fee from transaction amount based on ticket price
        let split: number = 0;
        if (price <= 20000) {
          split = amount * 0.925;  // 7.5%
        } else if (price > 20000 && price <= 100000) {
          split = amount * 0.95;  // 5.0%
        } else if (price > 100000) {
          split = amount * 0.975;  //2.5%
        };

        // Add the organizer's split to the event's total revenue
        await this.prisma.event.update({
          where: { id: eventId },
          data: {
            revenue: { increment: split },
          }
        });

        // Check if all the event tickets are sold out
        if (event.ticketTiers.every(tier => tier.soldOut === true)) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { status: "SOLD_OUT" }
          });

          // Notify the event organizer of the event's sold out status
          const subject = 'SOLD OUT!'
          const content = `Congratulations, your event titled: ${event.title} is sold out!`
          await this.mailService.sendEmail(event.organizer.email, subject, content);
        };

        // Create the required number of tickets
        let pdfs: Attachment[] = [];
        for (let i = 1; i <= quantity; i++) {
          const accessKey = randomUUID().split('-')[4]
          const qrcodeImage = await qrcode.toDataURL(accessKey, { errorCorrectionLevel: 'H' })

          const ticket = await this.prisma.ticket.create({
            data: {
              accessKey,
              price,
              tier: tier.name,
              discountPrice: discount && (amount / quantity),
              attendee,
              eventId
            }
          });

          // Generate ticket PDF and configure email attachment
          const ticketPDF = await generateTicketPDF(ticket, qrcodeImage, event);
          pdfs.push(ticketPDF);

          // Record ticket sale to update event ranking in trending events
          const trendingWindow = Date.now() - (72 * 60 * 60 * 1000);
          this.redis.multi()
            .zAdd(`event_log:${eventId}`, [{ score: trendingWindow, value: ticket.id.toString() }]) // Add new entry
            .zRemRangeByScore(`event_log:${eventId}`, 0, trendingWindow) // Remove all entries older than 72 hours
            .exec();
        };

        // Send an email with the ticket PDFs to the attendee
        const subject = 'Ticket Purchase'
        const content = `You have purchased tickets for the event: ${event.title}.
          Attached to this email are your ticket(s). They'll be required for entry at the event, keep them safe!`
        await this.mailService.sendEmail(attendee, subject, content, pdfs);

        // Update metrics value
        this.metrics.incrementCounter('tickets_purchased');
        this.metrics.incrementCounter('tickets_purchased_volume', [], amount);

        logger.info(`[${this.context}] Ticket purchase completed by ${attendee}.\n`);

        if (whatsappPhoneId) {
          // Send webhook to whatsapp bot server to notify attendee of payment status
          return notifyWhatsappBotServer('success', attendee, whatsappPhoneId);
        } else {
          // Notify the client of payment status
          return this.gateway.sendPaymentStatus(attendee, 'success', 'Payment successful!');
        }
      } else if (eventType === 'charge.failed') {
        // Update transaction status
        await this.prisma.transaction.update({
          where: { reference: transactionReference },
          data: { status: "TX_FAILED" }
        });

        logger.warn(`[${this.context}] Ticket purchase failed: Email: ${attendee}\n`);

        if (whatsappPhoneId) {
          // Send webhook to whatsapp bot server to notify attendee of payment status
          return notifyWhatsappBotServer('failed', attendee, whatsappPhoneId);
        } else {
          // Notify the client of payment status
          return this.gateway.sendPaymentStatus(attendee, 'failed', 'Payment failed!');
        }
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ticket purchase. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('transfer')
  async finalizeTransfer(job: Job) {
    const { eventType, metadata, reason, recipientCode, amount, transactionReference } = job.data;
    const { email, eventId } = metadata;

    const event = await this.prisma.event.findUnique({
      where: { id: parseInt(eventId) }
    });

    try {
      // Idempotent processing to skip transfers that have been settled
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference: transactionReference }
      });
      if (transaction && transaction.status !== "TRANSFER_PENDING") return;

      if (eventType === 'transfer.success') {
        if (reason === 'Ticket Refund') {
          // Notify the attendee of the ticket refund
          const content = `Ticket refund has been completed for the cancelled event: ${event.title}. Thanks for your patience.`;
          await this.mailService.sendEmail(email, reason, content);

          // Remove attendee as a transfer recipient after ticket refund
          await this.payments.deleteTransferRecipient(recipientCode);

          // Update metrics value
          this.metrics.incrementCounter('ticket_refunds');
          this.metrics.incrementCounter('ticket_refund_volume', [], amount);
        } else if (reason === 'Revenue Split') {
          // Notify the organizer of revenue payout
          const content = `Congratulations on the success of your event: ${event.title}. Payout of your event revenue has been initiated.
            Thank you for choosing our platform!`;
          await this.mailService.sendEmail(email, reason, content);

          // Update metrics value
          this.metrics.incrementCounter('payout_volume', [], amount);
        }

        // Update transfer status
        await this.prisma.transaction.update({
          where: { reference: transactionReference },
          data: { status: "TRANSFER_SUCCESS" }
        });

        logger.info(`[${this.context}] ${reason}: Transfer to ${email} was successful!\n`)
        return;
      } else if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
        // Update transfer status
        await this.prisma.transaction.update({
          where: { reference: transactionReference },
          data: { status: "TRANSFER_FAILED" }
        });

        // Update metrics value
        this.metrics.incrementCounter('unsuccessful_transfers');

        logger.warn(`[${this.context}] ${reason}: Transfer to ${email} failed or reversed.\n`);
        return;
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ${reason} transfer to ${email}. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('refund')
  async processRefund(job: Job) {
    const { eventType, metadata, amount, refundId, transactionReference } = job.data;
    const { email, eventTitle, date } = metadata;

    try {
      // Idempotent processing to skip refunds that have been settled
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference: transactionReference }
      });
      if (transaction && transaction.status !== "REFUND_PENDING") return;

      if (eventType === 'refund.processed') {
        // Update transaction status
        await this.prisma.transaction.update({
          where: { reference: transactionReference },
          data: { refundId, status: "REFUND_SUCCESS" }
        });

        // Update metrics value
        this.metrics.incrementCounter('transaction_refunds');
      } else if (eventType === 'refund.failed') {
        // Update transaction status
        await this.prisma.transaction.update({
          where: { reference: transactionReference },
          data: { refundId, status: "REFUND_FAILED" }
        });

        // Update metrics value
        this.metrics.incrementCounter('failed_refunds');

        const content = `A transaction refund has failed. Here are the details: \n
          Amount: ${amount}\n
          Email: ${email}\n
          Event Title: ${eventTitle}\n
          Date: ${date}\n

          Please, follow this up to ensure the attendee is refunded.
          `;
        await this.mailService.sendEmail(Secrets.ADMIN_EMAIL, 'Failed Transaction Refund', content);
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing transaction refund to ${email}. Error: ${error.message}\n`);
      throw error;
    }
  }
}