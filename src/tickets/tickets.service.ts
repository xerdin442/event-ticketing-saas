import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  AddTicketTierDTO,
  CreateDiscountDTO,
  CreateListingDTO,
  PurchaseTicketDTO,
  ValidateTicketDTO
} from './dto';
import { PaymentsService } from '../payments/payments.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Listing, TicketTier } from '@prisma/client';
import { EventsService } from '@src/events/events.service';
import { RedisClientType } from 'redis';
import { randomUUID } from 'crypto';
import * as argon from 'argon2';
import * as qrcode from "qrcode";
import { TicketDetails, TicketLockInfo } from '@src/common/types';
import { REDIS_CLIENT } from '@src/redis/redis.module';
import { Attachment } from 'resend';
import { generateTicketPDF } from '@src/common/util/document';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
    private readonly eventsService: EventsService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    @InjectQueue('tickets-queue') private readonly ticketsQueue: Queue
  ) { };

  async getTicketTiers(eventId: number): Promise<TicketTier[]> {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { ticketTiers: true },
      });

      return event.ticketTiers;
    } catch (error) {
      throw error;
    }
  }

  async addTicketTier(dto: AddTicketTierDTO, eventId: number): Promise<TicketTier> {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { ticketTiers: true }
      });
      for (let tier of event.ticketTiers) {
        if (tier.name === dto.name) {
          throw new BadRequestException(`A ticket tier named ${dto.name} has already been added to this event`)
        }
      };

      const tier = await this.prisma.ticketTier.create({
        data: {
          ...dto,
          eventId,
          discountStatus: dto.discount ? 'ACTIVE' : null,
        }
      });

      if (dto.discount) {
        // Set auto update of discount status based on discount expiration date
        await this.ticketsQueue.add(
          'discount-status-update',
          { tierId: tier.id },
          {
            jobId: `tier-${tier.id}-discount`,
            delay: Math.max(0, new Date(tier.discountExpiration).getTime() - new Date().getTime())
          }
        );
      };

      return tier;
    } catch (error) {
      throw error;
    }
  }

  async removeTicketTier(tierId: number): Promise<void> {
    try {
      const ticketTier = await this.prisma.ticketTier.findUnique({
        where: { id: tierId },
      });
      const event = await this.prisma.event.findUnique({
        where: { id: ticketTier.eventId },
        include: { tickets: true },
      });

      // Check if attendees have purchased this ticket tier
      const ticket = event.tickets.find(ticket => ticket.tier === ticketTier.name);
      if (!ticket) {
        await this.prisma.ticketTier.delete({
          where: { id: tierId },
        });
      } else {
        throw new BadRequestException('This ticket tier cannot be deleted');
      }
    } catch (error) {
      throw error;
    }
  }

  async createDiscount(tierId: number, dto: CreateDiscountDTO): Promise<void> {
    try {
      const ticketTier = await this.prisma.ticketTier.findUnique({
        where: { id: tierId }
      });

      if (ticketTier.discount) {
        throw new BadRequestException('This ticket already has a discount offer')
      }
      if (dto.numberOfDiscountTickets > ticketTier.totalNumberOfTickets) {
        throw new BadRequestException('Not enough tickets left to create discount offer')
      }
      if (dto.discountPrice > ticketTier.price) {
        throw new BadRequestException('Discount price cannot be higher than original price')
      }

      // Update ticket tier details with discount offer
      await this.prisma.ticketTier.update({
        where: { id: tierId },
        data: {
          discount: true,
          ...dto,
          discountStatus: 'ACTIVE',
        }
      });

      // Set auto update of discount status based on discount expiration date
      await this.ticketsQueue.add(
        'discount-status-update',
        { tierId },
        {
          jobId: `tier-${tierId}-discount`,
          delay: Math.max(0, new Date(dto.discountExpiration).getTime() - new Date().getTime())
        }
      );
    } catch (error) {
      throw error;
    }
  }

  async removeDiscount(tierId: number): Promise<void> {
    try {
      const ticketTier = await this.prisma.ticketTier.findUnique({
        where: { id: tierId }
      });

      if (ticketTier.discount) {
        await this.prisma.ticketTier.update({
          where: { id: ticketTier.id },
          data: {
            discount: false,
            discountPrice: null,
            discountExpiration: null,
            discountStatus: null,
            numberOfDiscountTickets: null
          }
        });

        // Delete discount status auto update
        await this.ticketsQueue.removeJobs(`tier-${ticketTier.id}-discount`);
      } else {
        throw new BadRequestException('No discount offer available in this tier');
      };
    } catch (error) {
      throw error;
    }
  }

  async purchaseTicket(dto: PurchaseTicketDTO, eventId: number): Promise<string> {
    try {
      let lockId: string;
      let amount: number;
      let discount: boolean = false;

      const { tier: ticketTier, quantity, email, whatsappPhoneId } = dto;

      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { ticketTiers: true }
      });
      const tier = event.ticketTiers.find(tier => tier.name === ticketTier);

      // Check if event is trending
      const trendingEvents = await this.eventsService.getTrendingEvents();
      const trendingEventIds = trendingEvents.map(event => event.id);
      const trending = trendingEventIds.includes(eventId);

      // Check if the number of tickets left is greater than or equal to the purchase quantity
      if (tier.totalNumberOfTickets >= quantity) {
        if (tier.discount) {
          discount = true; // Specify that this purchase was made on discount

          const currentTime = new Date().getTime();
          const expirationDate = new Date(tier.discountExpiration).getTime();

          // Check if the discount has expired and if the discount tickets left is greater than or equal to the purchase quantity
          if (currentTime < expirationDate && tier.numberOfDiscountTickets >= quantity) {
            // Calculate the ticket purchase amount using the discount price
            amount = tier.discountPrice * quantity;
          }
        } else {
          // Calculate the ticket purchase amount using the original price
          amount = tier.price * quantity;
        }

        if (!amount) throw new BadRequestException("Unable to calculate purchase amount. Please try again");

        if (trending) {
          lockId = randomUUID(); // Generate a lock ID to reserve the tickets
          const purchaseWindow = 185 * 1000 // Add a 5-second buffer to the 3-minute purchase window

          try {
            // Update number of tickets
            await this.prisma.$transaction(async (tx) => {
              await tx.ticketTier.update({
                where: { id: tier.id },
                data: {
                  numberOfDiscountTickets: (discount && { decrement: quantity }),
                  totalNumberOfTickets: { decrement: quantity }
                }
              });
            });
          } catch (error) {
            throw new BadRequestException('Unable to reserve tickets. Please try again');
          }

          const lockData: TicketLockInfo = {
            status: "locked",
            tierId: tier.id,
            discount,
            numberOfTickets: quantity,
          };

          // Store ticket lock info in cache
          await this.redis.setEx(
            `ticket_lock:${lockId}`,
            purchaseWindow / 1000,
            JSON.stringify(lockData)
          );

          // Unlock tickets once the purchase window expires
          await this.ticketsQueue.add(
            'ticket-lock',
            { lockId, ...lockData },
            { delay: purchaseWindow + 3000 } // Add a 3s delay to ensure Redis cache has cleared the lock info
          );
        }
      } else {
        throw new BadRequestException(`Insufficient ${tier.name} tickets. Check out other ticket tiers`);
      }

      // Configure metadata for purchase transaction
      const metadata = {
        email,
        eventId,
        tierId: tier.id,
        amount,
        discount,
        quantity,
        trending,
        lockId,
        whatsappPhoneId,
      };

      // Initialize ticket purchase
      const { authorization_url, reference } = await this.payments.initializeTransaction(email, amount, metadata);

      // Hash whatsapp phone ID if available
      const hashedPhoneId = whatsappPhoneId ? await argon.hash(whatsappPhoneId) : null;

      // Store transaction reference
      await this.prisma.transaction.create({
        data: {
          amount,
          reference,
          email,
          source: "PURCHASE",
          status: "TX_PENDING",
          eventId,
          lockId,
          lockStatus: trending ? "LOCKED" : null,
          whatsapp: whatsappPhoneId ? true : false,
          whatsappPhoneId: hashedPhoneId,
        }
      });

      return authorization_url;
    } catch (error) {
      throw error;
    }
  }

  async createTicket(details: TicketDetails): Promise<Attachment> {
    try {
      const { eventId } = details;

      // Generate and encode unique access key in QRcode image
      const accessKey = randomUUID().split('-')[4]
      const qrcodeImage = await qrcode.toDataURL(accessKey, { errorCorrectionLevel: 'H' })

      // Create new ticket
      const ticket = await this.prisma.ticket.create({
        data: {
          accessKey,
          ...details,
        }
      });

      // Generate ticket PDF and configure email attachment
      const event = await this.prisma.event.findUniqueOrThrow({
        where: { id: eventId }
      });
      const ticketPDF = await generateTicketPDF(ticket, qrcodeImage, event);

      // Ensure auto-update of status when ticket expires
      const updateDelay = (new Date(event.endTime).getTime() + 1500) - new Date().getTime();
      await this.ticketsQueue.add(
        'ticket-status-update',
        { ticketId: ticket.id },
        { delay: Math.max(0, updateDelay) }
      );

      // Record ticket sale to update event ranking in trending events
      const currentTime = Date.now()
      const trendingWindow = currentTime - (72 * 60 * 60 * 1000);
      this.redis.multi()
        .zAdd(`event_log:${eventId}`, [{ score: currentTime, value: ticket.id.toString() }]) // Add new entry
        .zRemRangeByScore(`event_log:${eventId}`, 0, trendingWindow) // Remove all entries older than 72 hours
        .exec();

      return ticketPDF;
    } catch (error) {
      throw error;
    }
  }

  async validateTicket(eventId: number, dto: ValidateTicketDTO): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: {
          eventId,
          accessKey: dto.accessKey
        }
      });

      if (ticket) {
        if (ticket.status === 'ACTIVE') {
          await this.prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'USED' }
          });

          return;
        } else if (ticket.status === 'USED') {
          throw new BadRequestException('This ticket has already been used');
        } else if (ticket.status === 'LOCKED') {
          throw new BadRequestException('This ticket has been listed for resale');
        } else {
          throw new BadRequestException('Invalid ticket. Please try again')
        };
      } else {
        throw new BadRequestException('Invalid QRcode or access key. Please confirm that the ticket is for this event');
      }
    } catch (error) {
      throw error;
    }
  }

  async populateMarketplace(): Promise<Listing[]> {
    try {
      const listings = await this.prisma.listing.findMany({
        include: {
          ticket: {
            select: {
              tier: true,
              event: {
                select: {
                  title: true,
                  date: true,
                }
              }
            }
          }
        }
      })

      return listings.map(listing => {
        return {
          ...listing,
          recipientCode: "", // Hide payment info before populating listings
        }
      })
    } catch (error) {
      throw error;
    }
  }

  async createListing(userId: number, dto: CreateListingDTO): Promise<void> {
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId }
      })

      const ticket = await this.prisma.ticket.findUnique({
        where: { accessKey: dto.accessKey }
      })

      // Check that the access key is valid
      if (!ticket) {
        throw new BadRequestException('Invalid access key')
      }

      // Verify ticket ownership
      if (ticket.attendee !== user.email) {
        throw new BadRequestException('A ticket can only be listed for resale by its owner')
      }

      // Verify attendee's account details
      await this.payments.verifyAccountDetails({ ...dto });

      // Create recipient code to process transfer of sales amount
      const recipientCode = await this.payments.createTransferRecipient({ ...dto })

      if (ticket.status === 'ACTIVE') {
        // Create new listing
        await this.prisma.listing.create({
          data: {
            userId,
            ticketId: ticket.id,
            price: ticket.discountPrice ? ticket.discountPrice : ticket.price,
            recipientCode
          }
        })

        // Update status of ticket
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: 'LOCKED' }
        })

        return;
      } else {
        throw new BadRequestException('Only active tickets can be listed for resale')
      }
    } catch (error) {
      throw error;
    }
  }

  async buyListing(ticketId: number, email: string): Promise<string> {
    try {
      const listing = await this.prisma.listing.findUniqueOrThrow({
        where: {
          ticketId,
          ticket: { status: 'LOCKED' },
        },
        include: {
          ticket: {
            select: { eventId: true }
          }
        }
      });

      // Initialize ticket resale
      const { authorization_url, reference } = await this.payments.initializeTransaction(email, listing.price, { ticketId });

      // Store transaction reference
      await this.prisma.transaction.create({
        data: {
          amount: listing.price,
          reference,
          email,
          source: "RESALE",
          status: "TX_PENDING",
          eventId: listing.ticket.eventId,
        }
      });

      return authorization_url;
    } catch (error) {
      throw error;
    }
  }

  async deleteListing(ticketId: number): Promise<void> {
    try {
      const listing = await this.prisma.listing.findUnique({
        where: {
          ticketId,
          ticket: { status: 'LOCKED' },
        }
      });
      if (!listing) {
        throw new BadRequestException('No listing found for this ticket');
      }

      await this.prisma.$transaction(async (tx) => {
        // Remove listing from marketplace
        await tx.listing.delete({
          where: { ticketId }
        });

        // Update ticket status
        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: 'ACTIVE' }
        });
      })
    } catch (error) {
      throw error;
    }
  }
}
