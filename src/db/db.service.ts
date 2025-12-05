import { Injectable } from '@nestjs/common';
import logger from '../common/logger';
import { Secrets } from '../common/secrets';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@generated/client';

@Injectable()
export class DbService extends PrismaClient {
  private context = DbService.name;

  constructor() {
    const adapter = new PrismaPg({ connectionString: Secrets.DATABASE_URL });
    super({ adapter });
  }

  async cleanDb() {
    return this.$transaction([
      this.transaction.deleteMany(),
      this.listing.deleteMany(),
      this.ticket.deleteMany(),
      this.ticketTier.deleteMany(),
      this.event.deleteMany(),
      this.organizer.deleteMany(),
      this.user.deleteMany()
    ])
      .then(() => logger.info(`[${this.context}] Database cleaned up for tests.\n`))
      .catch(error => logger.error(`[${this.context}] An error occurred while cleaning database. Error: ${error.message}.\n`));
  }
}
