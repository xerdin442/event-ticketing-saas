import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { REDIS_CLIENT } from "@src/redis/redis.module";
import { RedisClientType } from "redis";

@Injectable()
export class TokenBlacklistGuard implements CanActivate {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();

      const header = request.headers['authorization'];
      if (!header) return null;
      const [type, jwt] = header.split(' ');
      const token = type === 'Bearer' ? jwt : null;

      // JWT auth guard will reject the request since token is missing
      if (!token) return true;

      // Check cache if the token is blacklisted
      const cacheKey = `blacklisted_tokens:${token}`
      const isBlacklisted = await this.redis.get(cacheKey) as string;

      if (isBlacklisted) {
        throw new UnauthorizedException('Session expired. Please log in.');
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}