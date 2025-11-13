import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  AddTicketTierDto,
  CreateDiscountDto,
  PurchaseTicketDto,
  ValidateTicketDto
} from './dto';
import { PaymentsService } from '../payments/payments.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { TicketTier } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
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

  async addTicketTier(dto: AddTicketTierDto, eventId: number): Promise<void> {
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

  async createDiscount(tierId: number, dto: CreateDiscountDto): Promise<void> {
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

  async purchaseTicket(dto: PurchaseTicketDto, eventId: number): Promise<string> {
    try {
      let amount: number;
      let discount: boolean = false;

      const user = await this.prisma.user.findUnique({
        where: { email: dto.email }
      });
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { ticketTiers: true }
      });
      const tier = event.ticketTiers.find(tier => tier.name === dto.tier);

      // Check if the number of tickets left is greater than or equal to the purchase quantity
      if (tier.totalNumberOfTickets >= dto.quantity) {
        // Check if a discount is available
        if (tier.discount) {
          discount = true; // Specify that this purchase was made on discount

          const currentTime = new Date().getTime();
          const expirationDate = new Date(tier.discountExpiration).getTime();

          // Check if the discount has expired and if the discount tickets left is greater than or equal to the purchase quantity
          if (currentTime < expirationDate && tier.numberOfDiscountTickets >= dto.quantity) {
            // Calculate the ticket purchase amount using the discount price
            amount = tier.discountPrice * dto.quantity;
          }
        } else {
          // Calculate the ticket purchase amount using the original price
          amount = tier.price * dto.quantity;
        }
      } else {
        throw new BadRequestException(`Insufficient ${tier.name} tickets. Check out other ticket tiers`);
      }

      // Configure metadata for purchase transaction
      const metadata = {
        email: dto.email,
        eventId,
        tierId: tier.id,
        amount,
        discount,
        quantity: dto.quantity
      };

      // Initialize ticket purchase
      return this.payments.initializeTransaction(user.email, amount * 100, metadata);
    } catch (error) {
      throw error;
    }
  }

  async validateTicket(dto: ValidateTicketDto): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { accessKey: dto.accessKey }
      });

      if (ticket) {
        if (ticket.status === 'USED') {
          throw new BadRequestException('This ticket has already been used');
        };

        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: 'USED' }
        });

        return;
      } else {
        throw new BadRequestException('Invalid QRcode or access key');
      }
    } catch (error) {
      throw error;
    }
  }
}
