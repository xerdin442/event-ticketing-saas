import { BadRequestException, Injectable } from '@nestjs/common';
import { Organizer } from '@generated/client';
import { DbService } from '@src/db/db.service';
import { PaymentsService } from '@src/payments/payments.service';
import { CreateOrganizerProfileDTO, UpdateOrganizerProfileDTO } from './dto';
import { isURL } from 'class-validator';

@Injectable()
export class OrganizerService {
  constructor(
    private prisma: DbService,
    private readonly payments: PaymentsService
  ) { };

  async getProfile(userId: number): Promise<Organizer> {
    try {
      return this.prisma.organizer.findUnique({
        where: { userId }
      })
    } catch (error) {
      throw error;
    }
  }

  async createProfile(userId: number, dto: CreateOrganizerProfileDTO): Promise<Organizer> {
    try {
      const organizer = await this.prisma.organizer.findUnique({
        where: { userId }
      });

      if (organizer) {
        throw new BadRequestException('This user already has an organizer profile');
      };

      const isValidUrl: boolean = isURL(dto.website, { protocols: ['https'] });
      if (dto.website && !isValidUrl) {
        throw new BadRequestException('Please enter a valid webiste URL');
      };

      // Verify organizer's account details before creating transfer recipient for revenue splits
      await this.payments.verifyAccountDetails({ ...dto });
      const recipientCode = await this.payments.createTransferRecipient({ ...dto });

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

  async updateProfile(userId: number, dto: UpdateOrganizerProfileDTO): Promise<Organizer> {
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

      const isValidUrl: boolean = isURL(dto.website, { protocols: ['https'] });
      if (dto.website && !isValidUrl) {
        throw new BadRequestException('Please enter a valid webiste URL');
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

  async deleteProfile(userId: number): Promise<void> {
    try {
      const events = await this.prisma.event.findMany({
        where: { 
          organizer: { userId }
        }
      })

      // Check if the organizer has active events
      const activeEvents = events.filter(event => {
        return event.status === 'UPCOMING' || event.status === 'ONGOING' || event.status === 'SOLD_OUT';
      });

      if (activeEvents.length > 0) {
        throw new BadRequestException('This profile cannot be deleted because it has active events');
      } else {
        // Delete organizer profile if there are no active events
        await this.prisma.organizer.delete({
          where: { userId }
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async getProfileById(organizerId: number): Promise<Organizer> {
    try {
      return this.prisma.organizer.findUnique({
        where: { id: organizerId },
        include: {
          events: {
            select: {
              id: true,
              title: true,
              poster: true,
            }
          }
        }
      });
    } catch (error) {
      throw error;
    }
  }
}
