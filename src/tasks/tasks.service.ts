import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "../common/logger";
import { DbService } from "../db/db.service";
import { RedisClientType } from "redis";
import { UploadService } from "../common/config/upload";
import { REDIS_CLIENT } from "@src/redis/redis.module";

@Injectable()
export class TasksService {
  private readonly context: string = TasksService.name;

  constructor(
    private readonly prisma: DbService,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) { };

  @Cron(CronExpression.EVERY_WEEK)
  async deleteUnusedCloudinaryResources(): Promise<void> {
    let localResources: string[] = [];
    let unusedResources: string[] = [];

    const extractPublicId = (link: string): string => {
      return link.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, "")
    };

    try {
      // Extract the public IDs of all event posters
      const events = await this.prisma.event.findMany({ select: { poster: true } });
      events.forEach(event => localResources.push(extractPublicId(event.poster)));

      // Fetch all resources uploaded to Cloudinary
      const cloudResources = await UploadService.getAllResources();

      // Filter and delete all unused resources
      for (let resource of cloudResources) {
        if (!localResources.includes(resource)) {
          unusedResources.push(resource)
        };
      };

      if (unusedResources.length > 0) {
        await UploadService.deleteResources(unusedResources);

        logger.info(`[${this.context}] Cloudinary storage cleaned up successfully.\n`);
        return;
      };

      logger.info(`[${this.context}] No unused resources found in Cloudinary.\n`);
      return;
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while deleting unused Cloudinary resources. Error: ${error.message}\n`);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateTrendingEvents() {
    try {
      let cursor = '0';
      let allKeys: string[] = [];

      do {
        const { cursor: nextCursor, keys } = await this.redis.scan(cursor, {
          MATCH: 'event_log:*',
          COUNT: 500,
        });

        // Add the found keys to the result array
        allKeys = allKeys.concat(keys);

        // Update the cursor for the next iteration
        cursor = nextCursor;
      } while (cursor !== '0');

      if (allKeys.length === 0) return;

      // Pair every event and its ticket sales score
      const rankingUpdates = [];
      for (const key of allKeys) {
        const eventId = key.split(':')[1];
        const ticketCount = await this.redis.zCard(key);

        rankingUpdates.push({
          score: ticketCount,
          value: eventId
        });
      }

      // Rank the events by ticket sales within the last 72 hours
      await this.redis.zAdd('trending_events', rankingUpdates);

      logger.info(`[${this.context}] Trending event rankings updated successfully.\n`);
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while updating trending event rankings. Error: ${error.message}\n`);
      throw error;
    }
  }
}
