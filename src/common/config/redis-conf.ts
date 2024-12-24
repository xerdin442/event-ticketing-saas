import { createClient, RedisClientType } from "redis";
import logger from "../logger";

export const initializeRedis = (url: string, index: number, context: string): RedisClientType => {
  const redis: RedisClientType = createClient({
    url,
    database: index
  });

  redis.connect()
    .then(() => logger.info(`[${context}] is connected to Redis\n`))
    .catch(error => {
      logger.error(`[${context}] Redis connection error: ${error.message}\n`);
      throw error;
    });
  
  return redis;
}