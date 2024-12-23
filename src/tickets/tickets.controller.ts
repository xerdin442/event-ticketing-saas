import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AuthGuard } from '@nestjs/passport';
import { PurchaseTicketDto, ValidateTicketDto } from './dto';
import { GetUser } from '../custom/decorators';
import { EventOrganizerGuard } from '../custom/guards';
import { User } from '@prisma/client';
import logger from '../common/logger';

@UseGuards(AuthGuard('jwt'))
@Controller('events/:eventId/tickets')
export class TicketsController {
  private readonly context: string = TicketsService.name;

  constructor(private readonly ticketsService: TicketsService) { };

  @HttpCode(HttpStatus.OK)
  @Post('purchase')
  async purchaseTicket(
    @Body() dto: PurchaseTicketDto,
    @Param('eventId', ParseIntPipe) eventId: number,
    @GetUser() user: User
  ): Promise<{ checkout: string }> {
    try {
      const checkout = await this.ticketsService.purchaseTicket(dto, eventId, user.id);
      logger.info(`[${this.context}] ${user.email} initiated ticket purchase.\n`);

      return { checkout };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while intitiating ticket purchase. Error: ${error.message}\n`);
      throw error;
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('validate')
  @UseGuards(EventOrganizerGuard)
  async validateTicket(
    @Body() dto: ValidateTicketDto,
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<{ message: string }> {
    try {
      await this.ticketsService.validateTicket(dto, eventId);
      return { message: 'Ticket validation successful' };
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while validating event ticket. Error: ${error.message}\n`);
      throw error;
    }
  }
}
