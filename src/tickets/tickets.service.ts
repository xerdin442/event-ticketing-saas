import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  AddTicketTierDto,
  PurchaseTicketDto,
  ValidateTicketDto
} from './dto';
import { PaymentsService } from '../payments/payments.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService,
    @InjectQueue('tickets-queue') private readonly ticketsQueue: Queue
  ) { };

  async addTicketTier(dto: AddTicketTierDto, eventId: number): Promise<void> {
    try {
      const { name, price, totalNumberOfTickets, discount, benefits, discountExpiration, discountPrice, numberOfDiscountTickets } = dto;

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
          name,
          price: +price,
          totalNumberOfTickets: +totalNumberOfTickets,
          discount,
          benefits,
          eventId
        }
      });

      if (discount) {
        await this.prisma.ticketTier.update({
          where: { id: tier.id },
          data: {
            discountPrice: +discountPrice,
            discountExpiration,
            discountStatus: 'ACTIVE',
            numberOfDiscountTickets: +numberOfDiscountTickets
          }
        });

        // Set auto update of discount status based on the expiration date
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

  async removeDiscount(eventId: number, tier: string): Promise<void> {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { ticketTiers: true }
      });
      const ticketTier = event.ticketTiers.find(ticketTier => ticketTier.name === tier);

      if (!ticketTier) {
        throw new BadRequestException(`No ticket tier named ${tier} in this event`);
      };

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

  async purchaseTicket(dto: PurchaseTicketDto, eventId: number, userId: number): Promise<string> {
    let amount: number;
    let discount: boolean = false;
    let ticketTier: string;

    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTiers: true }
    });

    // Check if the user is restricted by age from attending the event
    if (user.age > event.ageRestriction) {
      for (let tier of event.ticketTiers) {
        // Find the tier and check if the number of tickets left is greater than or equal to the purchase quantity
        if (tier.name === dto.tier && tier.totalNumberOfTickets >= dto.quantity) {
          ticketTier = tier.name;

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
      }
    } else {
      throw new UnauthorizedException(`You must be at least ${event.ageRestriction} years old to attend this event`);
    };

    // Configure metadata for purchase transaction
    const metadata = {
      userId,
      eventId,
      ticketTier,
      amount,
      discount,
      quantity: dto.quantity
    };

    // Initialize ticket purchase
    return this.payments.initializeTransaction(user.email, amount * 100, metadata);
  }

  async validateTicket(dto: ValidateTicketDto, eventId: number): Promise<void> {
    const ticket = await this.prisma.ticket.findUnique({
      where: {
        accessKey: dto.accessKey,
        eventId
      }
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
  }
}
