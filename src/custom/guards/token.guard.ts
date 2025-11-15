import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { initializeRedis } from "@src/common/config/redis-conf";
import { Secrets } from "@src/common/env";
import { RedisClientType } from "redis";

@Injectable()
export class TokenBlacklistGuard implements CanActivate {

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const redis: RedisClientType = await initializeRedis(
      Secrets.REDIS_URL,
      'Blacklisted Tokens',
      Secrets.BLACKLISTED_TOKENS_STORE_INDEX,
    );

    try {
      const request = context.switchToHttp().getRequest();

      const header = request.headers['authorization'];
      if (!header) return null;
      const [type, jwt] = header.split(' ');
      const token = type === 'Bearer' ? jwt : null;

      // JWT auth guard will reject request since token is missing
      if (!token) return true;

      // Check cache if the token is blacklisted
      const isBlacklisted = await redis.get(token) as string;
      if (isBlacklisted) {
        throw new UnauthorizedException('Session expired. Please log in.');
      }

      return true;
    } catch (error) {
      throw error;
    } finally {
      redis.destroy();
    }
  }
}