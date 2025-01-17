import { Process, Processor } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Job } from "bull";
import { PaymentsGateway } from "../../payments/payments.gateway";
import { DbService } from "../../db/db.service";
import { PaymentsService } from "../../payments/payments.service";
import { randomUUID } from "crypto";
import * as qrcode from "qrcode";
import { sendEmail } from "../config/mail";
import logger from "../logger";
import { generateTicketPDF } from "../util/document";
import { EmailAttachment } from "../types";
import { MetricsService } from "../../metrics/metrics.service";

@Injectable()
@Processor('payments-queue')
export class PaymentsProcessor {
  private readonly context: string = PaymentsProcessor.name;

  constructor(
    private readonly gateway: PaymentsGateway,
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
    private readonly metrics: MetricsService
  ) { };

  @Process('transaction')
  async finalizeTransaction(job: Job) {
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
    const userRefundRecipientCode = await this.payments.createTransferRecipient({
      accountName: user.accountName,
      accountNumber: user.accountNumber,
      bankName: user.bankName
    });

    let split: number;
    let price: number;
    let pdfs: EmailAttachment[] = [];
    let discountPrice: null | number = null;

    try {
      if (discount) {
        discountPrice = amount / quantity
      };

      if (eventType === 'charge.success') {
        for (let tier of event.ticketTiers) {
          if (tier.name === ticketTier) {
            price = tier.price;

            try {
              await this.prisma.$transaction(async (tx) => {
                // Check total number of tickets left
                if (tier.totalNumberOfTickets < quantity) {
                  throw new Error(`Insufficient ${tier.name} tickets`);
                };

                if (discount) {
                  // Check number of discount tickets left
                  if (tier.numberOfDiscountTickets < quantity) {
                    throw new Error(`Discount ${tier.name} tickets are sold out! Please purchase regular tickets`);
                  };

                  // Check if the discount offer has expired
                  const currentTime = new Date().getTime();
                  const expirationDate = new Date(tier.discountExpiration).getTime();
                  if (currentTime > expirationDate) {
                    throw new Error(`Discount offer for ${tier.name} tickets has expired. Please purchase regular tickets`);
                  };

                  // Decrement the number of discount tickets and total number of tickets left in the tier
                  await tx.ticketTier.update({
                    where: { id: tier.id },
                    data: {
                      numberOfDiscountTickets: { decrement: quantity },
                      totalNumberOfTickets: { decrement: quantity }
                    }
                  });
                } else {
                  // Decrement the total number of tickets left in the tier
                  await tx.ticketTier.update({
                    where: { id: tier.id },
                    data: {
                      totalNumberOfTickets: { decrement: quantity }
                    }
                  });
                };

                // Check the number of discount tickets left and update status of the discount offer
                if (tier.numberOfDiscountTickets === 0) {
                  await tx.ticketTier.update({
                    where: { id: tier.id },
                    data: { discountStatus: "ENDED" }
                  });
                };

                // Check the total number of tickets left and update status of the ticket tier
                if (tier.totalNumberOfTickets === 0) {
                  await tx.ticketTier.update({
                    where: { id: tier.id },
                    data: { soldOut: true }
                  });
                };
              });
            } catch (error) {
              // Initiate transfer of transaction refund
              // await this.payments.initiateTransfer(
              //   userRefundRecipientCode,
              //   amount,
              //   'Transaction Refund',
              //   {
              //     userId,
              //     eventTitle: event.title,
              //     retryKey: randomUUID().replace(/-/g, '')
              //   }
              // );

              this.metrics.incrementTransactionRefunds(); // Update the transaction refunds count
              logger.warn(`[${this.context}] Ticket purchase processing failed. Transaction refund to ${user.email} initiated.\n`);

              // Notify the user of the payment status
              return this.gateway.sendPaymentStatus(
                user.email,
                'refund',
                `Transaction failed: ${error.message}. This is due to too many purchase requests being processed simultaneously on our server.
                  A refund of your initial purchase amount has been initiated. Please try again in a few minutes.`
              );
            };
          }
        };

        // Calculate and subtract the platform fee from transaction amount based on ticket price
        if (price <= 20000) {
          split = amount * 0.925;  // 7.5%
        } else if (price > 20000 && price <= 100000) {
          split = amount * 0.95;  // 5.0%
        } else if (price > 100000) {
          split = amount * 0.975;  //2.5%
        };

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

        // Check if all the event tickets are sold out
        if (event.ticketTiers.every(tier => tier.soldOut === true)) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { status: "SOLD_OUT" }
          });

          // Notify the event organizer of the event's sold out status
          const subject = 'SOLD OUT!'
          const content = `Congratulations, your event titled: ${event.title} is sold out!`
          await sendEmail(event.organizer, subject, content);

          // Intitiate transfer of the event revenue
          // await this.payments.initiateTransfer(
          //   event.organizer.recipientCode,
          //   event.revenue * 100,
          //   'Revenue Split',
          //   {
          //     userId: event.organizer.userId,
          //     eventTitle: event.title,
          //     retryKey: randomUUID().replace(/-/g, '')
          //   }
          // );
        };

        // Create the required number of tickets
        for (let i = 1; i <= quantity; i++) {
          const accessKey = randomUUID().split('-')[4]
          const qrcodeImage = await qrcode.toDataURL(accessKey, { errorCorrectionLevel: 'H' })

          const ticket = await this.prisma.ticket.create({
            data: {
              accessKey,
              price,
              tier: ticketTier,
              discountPrice,
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

        // Notify the client of payment status via WebSocket connection
        return this.gateway.sendPaymentStatus(user.email, 'success', 'Payment successful!');
      } else if (eventType === 'charge.failed') {
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

        // Notify the client of payment status via WebSocket connection
        return this.gateway.sendPaymentStatus(user.email, 'failed', 'Payment unsuccessful!');;
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ticket purchase. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Process('transfer')
  async finalizeTransfer(job: Job) {
    const { eventType, metadata, reason, recipientCode } = job.data;
    const { userId, eventTitle } = metadata;

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    try {
      if (eventType === 'transfer.success') {
        if (reason === 'Ticket Refund') {
          // Notify the attendee of the ticket refund
          const content = `Ticket refund has been completed for the cancelled event: ${eventTitle}. Thanks for your patience.`;
          await sendEmail(user, reason, content);
        } else if (reason === 'Revenue Split') {
          // Notify the organizer of the transfer of the revenue split
          const content = `Congratulations on the success of your event: ${eventTitle}. Transfer of your event revenue has been initiated.
            Thank you for choosing our platform!`;
          await sendEmail(user, reason, content);
        }

        await this.payments.deleteTransferRecipient(recipientCode); // Delete recipient after transfer success

        logger.info(`[${this.context}] ${reason}: Transfer to ${user.email} was successful!\n`)
        return;
      } else if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
        this.metrics.incrementUnsuccessfulTransfers();  // Update number of unsuccessful transfers
        logger.info(`[${this.context}] ${reason}: Transfer to ${user.email} failed or reversed.\n`);

        // Initiate transfer retry after 30 minutes
        setTimeout(async () => {
          try {
            await this.payments.retryTransfer(job.data, user);
          } catch (error) {
            throw error;
          }
        }, 30 * 60 * 1000);

        return;
      }
    } catch (error) {
      logger.error(`[${this.context}] An error occured while processing ${reason} transfer to ${user.email}. Error: ${error.message}\n`);
      throw error;
    }
  }
}