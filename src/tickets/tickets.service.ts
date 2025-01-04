import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PurchaseTicketDto, ValidateTicketDto } from './dto';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService
  ) { };

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
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { tickets: true }
    });

    const ticket = event.tickets.find(ticket => ticket.accessKey === dto.accessKey);
    if (ticket) {
      if (ticket.status === 'USED') {
        throw new BadRequestException('This ticekt has already been used');
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
