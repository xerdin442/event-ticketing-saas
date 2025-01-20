import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import {
  CreateOrganizerProfileDto,
  UpdateOrganizerProfileDto,
  UpdateProfileDto
} from './dto';
import {
  Event,
  Organizer,
  Ticket,
  User
} from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { sanitizeUserOutput } from '../common/util/helper';

@Injectable()
export class UserService {
  constructor(
    private prisma: DbService,
    private readonly payments: PaymentsService
  ) { };

  async updateProfile(userId: number, dto: UpdateProfileDto, filePath?: string): Promise<User> {
    try {
      const { accountName, accountNumber, bankName } = dto;

      // Verify new account details
      if (accountNumber) {
        await this.payments.verifyAccountDetails({ accountName, accountNumber, bankName });
      }

      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...dto,
          ...(dto.age !== undefined && { age: +dto.age }),
          ...(filePath && { profileImage: filePath })
        }
      });
      
      return sanitizeUserOutput(user);
    } catch (error) {
      throw error;
    }
  }

  async deleteAccount(userId: number): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id: userId }
      })
    } catch (error) {
      throw error;
    }
  }

  async createOrganizerProfile(userId: number, dto: CreateOrganizerProfileDto): Promise<Organizer> {
    try {
      // Verify organizer's account details before creating transfer recipient for revenue splits
      const details = {
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName
      };
      await this.payments.verifyAccountDetails(details);
      const recipientCode = await this.payments.createTransferRecipient(details);

      return this.prisma.organizer.create({
        data: {
          ...dto,
          recipientCode,
          userId
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async updateOrganizerProfile(userId: number, dto: UpdateOrganizerProfileDto): Promise<Organizer> {
    try {
      let recipientCode: string;
      // Verify updated account details and create a new transfer recipient for revenue splits
      if (dto.accountNumber) {
        const details = {
          accountName: dto.accountName,
          accountNumber: dto.accountNumber,
          bankName: dto.bankName
        };
        await this.payments.verifyAccountDetails(details);
        recipientCode = await this.payments.createTransferRecipient(details);
      };

      return this.prisma.organizer.update({
        where: { userId },
        data: {
          ...dto,
          recipientCode
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteOrganizerProfile(userId: number): Promise<void> {
    try {
      await this.prisma.organizer.delete({
        where: { userId }
      })
    } catch (error) {
      throw error;
    }
  } 

  async getAllEvents(role: string, userId: number): Promise<Event[]> {
    try {
      switch (role) {
        case 'organizer':
          // Get the details of all events where the user is the organizer
          return await this.prisma.event.findMany({
            where: { organizerId: userId }
          });

        case 'attendee':
          // Get all events where the user is an attendee
          return await this.prisma.event.findMany({
            where: {
              users: {
                some: { id: userId }
              }
            }
          });

        default:
          throw new BadRequestException('Invalid value for role parameter. Expected "organizer" or "attendee".');
      }
    } catch (error) {
      throw error;
    }
  }

  async getAllTickets(userId: number): Promise<Ticket[]> {
    try {
      return this.prisma.ticket.findMany({
        where: { attendee: userId }
      });
    } catch (error) {
      throw error;
    }
  }
}
