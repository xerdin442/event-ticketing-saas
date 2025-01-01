import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateEventDto } from './dto';
import { PaymentsService } from '../payments/payments.service';
import axios from 'axios';
import { Event } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: DbService,
    private readonly payments: PaymentsService
  ) { };

  async createEvent(
    dto: CreateEventDto,
    userId: number,
    poster: string,
    media: string[]
  ): Promise<Event> {
    try {
      // Verify organizer's account details
      const details = {
        accountName: dto.accountName,
        accountNumber: dto.accountNumber,
        bankName: dto.bankName
      };
      await this.payments.verifyAccountDetails(details);
      const recipientCode = await this.payments.createTransferRecipient(details);

      // Encode event location in URL format and generate coordinates
      const location = `${dto.venue}+${dto.address}`.replace(/,/g, '').replace(/\s/g, '+');
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?q=${location}&format=json`);
      if (response.status === 200) {
        const { lat, lon } = response.data;
        const coordinates = { }
        // Add lat and lon to redis geolocation store
      } else {
        throw new BadRequestException('Failed to generate coordinates for venue and address');
      };

      // Create organizer profile for the user
      const organizer = await this.prisma.organizer.create({
        data: {
          name: [ ...dto.organizerName ],
          email: dto.organizerEmail,
          accountName: dto.accountName,
          accountNumber: dto.accountNumber,
          bankName: dto.bankName,
          recipientCode,
          phone: dto.phone,
          userId,
          instagram: dto.instagram,
          twitter: dto.twitter,
          website: dto.website,
          whatsapp: dto.whatsapp
        }
      });

      // Create and store event details
      const event = await this.prisma.event.create({
        data: {
          organizerId: organizer.id,
          title: dto.title,
          category: dto.category,
          description: dto.description,
          date: dto.date,
          startTime: dto.startTime,
          endTime: dto.endTime,
          ageRestriction: dto.ageRestriction,
          venue: dto.venue,
          address: dto.address,
          capacity: dto.capacity,
          numberOfShares: 0,
          poster,
          media,
          revenue: 0
        }
      });

      return event;
    } catch (error) {
      throw error;
    }
  }
}
