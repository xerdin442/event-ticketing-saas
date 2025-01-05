import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { updateProfileDto } from './dto';
import { Event, Ticket, User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: DbService) { };

  async updateProfile(userId: number, dto: updateProfileDto, filePath?: string): Promise<User> {
    try {
      let user: User;

      if (filePath) {
        user = await this.prisma.user.update({
          where: { id: userId },
          data: {
            ...dto,
            profileImage: filePath
          }
        });
      } else {
        user = await this.prisma.user.update({
          where: { id: userId },
          data: { ...dto }
        });
      }

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

  async getAllEvents(role: string, userId: number): Promise<Event[]> {
    try {
      switch (role) {
        case 'organizer':
          // Get the details of all events where the user is the organizer
          return await this.prisma.event.findMany({
            where: { organizerId: userId }
          });

        case 'attendee':
          // Get all events where the user is an attendee, including the tickets purchased by the user
          return await this.prisma.event.findMany({
            where: {
              tickets: {
                some: { attendee: userId }
              }
            },
            include: { tickets: true }
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
