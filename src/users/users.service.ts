import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { UpdateProfileDto } from './dto';
import {
  Event,
  Ticket,
  User
} from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: DbService) {};

  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<User> {
    try {
      // Update user's details
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { ...dto }
      });

      delete user.password;
      return user;
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

  async getAllEvents(role: string, email: string): Promise<Event[]> {
    try {
      switch (role) {
        case 'organizer':
          // Get the details of all events where the user is the organizer
          return await this.prisma.event.findMany({
            where: {
              organizer: {
                user: { email }
              }
            }
          });

        case 'attendee':
          // Get all events where the user is an attendee
          return await this.prisma.event.findMany({
            where: {
              tickets: {
                some: { attendee: email }
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

  async getAllTickets(email: string): Promise<Ticket[]> {
    try {
      return this.prisma.ticket.findMany({
        where: { attendee: email }
      });
    } catch (error) {
      throw error;
    }
  }

  async toggleAlertSubscription(userId: number, mode: 'on' | 'off'): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          alertsSubscription: mode === 'on' ? true : false,
        }
      });
    } catch (error) {
      throw error;
    }
  }
}
