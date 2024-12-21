import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { updateProfileDto } from './dto';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor (private prisma: DbService) {};

  async updateProfile(userId: number, dto: updateProfileDto): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { ...dto }
      })
  
      delete user.password
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
}
