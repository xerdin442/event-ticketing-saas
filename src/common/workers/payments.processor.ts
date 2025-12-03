import { Process, Processor } from "@nestjs/bull";
import { Inject, Injectable } from "@nestjs/common";
import { Job } from "bull";
import { PaymentsGateway } from "@src/payments/payments.gateway";
import { DbService } from "@src/db/db.service";
import { PaymentsService } from "@src/payments/payments.service";
import { randomUUID } from "crypto";
import { MailService } from "../config/mail";
import logger from "../logger";
import { MetricsService } from "@src/metrics/metrics.service";
import { Secrets } from "../secrets";
import { Attachment } from "resend";
import { RedisClientType } from "redis";
import { formatDate } from "../util/helper";
import * as qrcode from "qrcode";
import { TicketDetails, TicketLockInfo, WhatsappWebhookNotification } from "../types";
import { Ticket, TicketTier } from "prisma/generated/client";
import { REDIS_CLIENT } from "@src/redis/redis.module";
import { WhatsappService } from "@src/whatsapp/whatsapp.service";
import { TicketsService } from "@src/tickets/tickets.service";
import { generateTicketPDF } from "../util/document";

@Injectable()
@Processor('payments-queue')
export class PaymentsProcessor {
  private readonly context: string = PaymentsProcessor.name;

  constructor(
    private readonly gateway: PaymentsGateway,
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
    private readonly metrics: MetricsService,
    private readonly mailService: MailService,
    private readonly ticketsService: TicketsService,
    private readonly whatsappService: WhatsappService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) { };

  @Process('purchase')
  async finalizeTicketPurchase(job: Job) {
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

    const notification: WhatsappWebhookNotification = {
      status: 'success',
      email: attendee,
      phoneId: whatsappPhoneId,
      reference: randomUUID(),
      transactionRef: transactionReference,
    };

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

          if (whatsappPhoneId) {
            // Send webhook to whatsapp bot server to notify attendee of payment status
            const details: WhatsappWebhookNotification = {
              ...notification,
              status: 'refund',
              reason: error.message,
            };

            return this.whatsappService.sendWebhookNotification(details);
          }

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
          const details: TicketDetails = {
            attendee,
            eventId,
            price,
            tier: tier.name,
            discountPrice: discount && (amount / quantity),
          }

          const ticketPDF = await this.ticketsService.createTicket(details);
          pdfs.push(ticketPDF);
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
          return this.whatsappService.sendWebhookNotification(notification);
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

        logger.warn(`[${this.context}] Ticket purchase failed. Email: ${attendee}\n`);

        if (whatsappPhoneId) {
          // Send webhook to whatsapp bot server to notify attendee of payment status
          const details: WhatsappWebhookNotification = {
            ...notification,
            status: 'failed',
          };

          return this.whatsappService.sendWebhookNotification(details);
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

  @Process('resale')
  async finalizeTicketResale(job: Job) {
    const { eventType, metadata, transactionReference } = job.data;
    const buyer = metadata.buyer as string

    const ticketId = parseInt(metadata.ticketId);
    const ticket = await this.prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: {
        listing: true,
        event: true,
      }
    });
    const ticketOwner = ticket.attendee;

    try {
      // Idempotent processing to skip transactions that have been settled
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference: transactionReference }
      });
      if (transaction && transaction.status !== "TX_PENDING") return;

      if (eventType === 'charge.success') {
        // Generate new access key and encode in QRcode image
        const newAccessKey = randomUUID().split('-')[4];
        const qrcodeImage = await qrcode.toDataURL(newAccessKey, { errorCorrectionLevel: 'H' })
        let updatedTicket: Ticket;

        await this.prisma.$transaction(async (tx) => {
          // Update ticket details          
          updatedTicket = await tx.ticket.update({
            where: { id: ticket.id },
            data: {
              accessKey: newAccessKey,
              attendee: buyer,
            }
          });

          // Remove ticket listing from resale marketplace
          await tx.listing.delete({
            where: { ticketId: ticket.id }
          });

          // Update transaction status
          await tx.transaction.update({
            where: { reference: transactionReference },
            data: { status: "TX_SUCCESS" }
          });
        });

        // Initiate transfer of resale amount to ticket owner
        const transferReference = await this.payments.initiateTransfer(
          ticket.listing.recipientCode,
          ticket.listing.price,
          'Ticket Resale',
          {
            email: ticketOwner,
            eventId: ticket.eventId,
          }
        );

        // Record transfer details
        await this.prisma.transaction.create({
          data: {
            email: ticketOwner,
            amount: ticket.listing.price,
            reference: transferReference,
            source: "RESALE_TF",
            status: "TRANSFER_PENDING",
            eventId: ticket.eventId,
          }
        });

        // Generate and send ticket document to new owner
        const ticketPDF = await generateTicketPDF(updatedTicket, qrcodeImage, ticket.event);
        const content = `You have purchased tickets for the event: ${ticket.event.title}.
          Attached to this email are your ticket(s). They'll be required for entry at the event, keep them safe!`
        await this.mailService.sendEmail(buyer, 'Ticket Resale', content, [ticketPDF]);

        logger.info(`[${this.context}] Ticket resale completed by ${ticketOwner}. Buyer: ${buyer}\n`);

        // Notify the client of payment status
        return this.gateway.sendPaymentStatus(buyer, 'success', 'Payment successful!');
      } else if (eventType === 'charge.failed') {
        // Update transaction status
        await this.prisma.transaction.update({
          where: { reference: transactionReference },
          data: { status: "TX_FAILED" }
        });

        logger.warn(`[${this.context}] Ticket resale failed. Buyer: ${buyer}\n`);

        // Notify the client of payment status
        return this.gateway.sendPaymentStatus(buyer, 'failed', 'Payment failed!');
      }
    } catch (error) {
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
        let emailContent: string = "";

        if (reason === 'Ticket Refund') {
          // Notify the attendee of the ticket refund
          emailContent = `Ticket refund has been completed for the cancelled event: ${event.title}. Thanks for your patience.`;

          // Remove attendee as a transfer recipient after ticket refund
          await this.payments.deleteTransferRecipient(recipientCode);

          // Update metrics value
          this.metrics.incrementCounter('ticket_refunds');
          this.metrics.incrementCounter('ticket_refund_volume', [], amount);
        } else if (reason === 'Revenue Split') {
          // Notify the organizer of revenue payout
          emailContent = `Congratulations on the success of your event: ${event.title}. Payout of your event revenue has been processed.
            Thank you for choosing our platform!`;

          // Update metrics value
          this.metrics.incrementCounter('payout_volume', [], amount);
        } else if (reason === 'Ticket Resale') {
          // Notify ticket owner of successful sale
          emailContent = `Your ticket for the event: ${event.title} has been sold! Payout of the resale amount has been processed.
            Thank you for choosing our platform!`

          // Remove ticket owner as a transfer recipient after resale
          await this.payments.deleteTransferRecipient(recipientCode);

          // Update metrics value
          this.metrics.incrementCounter('ticket_resale');
          this.metrics.incrementCounter('ticket_resale_volume', [], amount);
        }

        // Send email to transfer recipient
        await this.mailService.sendEmail(email, reason, emailContent);

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