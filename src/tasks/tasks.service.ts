import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "../common/logger";
import { DbService } from "../db/db.service";
import { RedisClientType } from "redis";
import { initializeRedis } from "../common/config/redis-conf";
import { Secrets } from "../common/env";
import { UploadService } from "../common/config/upload";

@Injectable()
export class TasksService {
  private readonly context: string = TasksService.name;

  constructor(private readonly prisma: DbService) { };

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

  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateTrendingEvents() {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Trending Events',
      Secrets.TRENDING_EVENTS_STORE_INDEX,
    )

    try {
      let cursor = '0';
      let allKeys: string[] = [];

      do {
        const { cursor: nextCursor, keys } = await redis.scan(cursor, {
          MATCH: 'event_log:*',
          COUNT: 500,
        });

        // Add the found keys to the result array
        allKeys = allKeys.concat(keys);

        // Update the cursor for the next iteration
        cursor = nextCursor;
      } while (cursor !== '0');

      if (allKeys.length === 0) return;

      const rankingUpdates = [];
      for (const key of allKeys) {
        const eventId = key.split(':')[1];
        const ticketCount = await redis.zCard(key);

        rankingUpdates.push({
          score: ticketCount,
          value: eventId
        });
      }

      // Rank the events by ticket sales within the last 72 hours
      await redis.zAdd('trending-list', rankingUpdates);
    } catch (error) {
      logger.error(`[${this.context}] An error occurred while updating trending event rankings. Error: ${error.message}\n`);
      throw error;
    } finally {
      redis.destroy();
    }
  }
}
