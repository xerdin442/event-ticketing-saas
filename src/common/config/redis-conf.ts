import { createClient, RedisClientType } from "redis";
import logger from "../logger";

export const initializeRedis = async (url: string, index: number, context: string): Promise<RedisClientType> => {
  const redis: RedisClientType = createClient({
    url,
    database: index
  });

  try {
    await redis.connect();
    logger.info(`[${context}] Successfully connected to Redis`);
    
    return redis;
  } catch (error) {
    logger.error(`[${context}] Redis connection error: ${error.message}`);
    throw error;
  }
}