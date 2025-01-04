import { createClient, RedisClientType } from "redis";
import logger from "../logger";

export const initializeRedis = async (url: string, context: string, index?: number): Promise<RedisClientType> => {
  const redis: RedisClientType = createClient({
    url,
    database: index
  });

  try {
    await redis.connect();
    logger.info(`[${context}] Successfully connected to Redis\n`);
    
    return redis;
  } catch (error) {
    logger.error(`[${context}] Redis connection error: ${error.message}\n`);
    throw error;
  }
}