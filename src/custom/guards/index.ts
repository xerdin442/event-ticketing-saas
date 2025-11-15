import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { initializeRedis } from "@src/common/config/redis-conf";
import { Secrets } from "@src/common/env";
import { DbService } from "@src/db/db.service";
import { RedisClientType } from "redis";

@Injectable()
export class EventOrganizerGuard implements CanActivate {
  constructor(private readonly prisma: DbService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      // Fetch the event and its organizer profile
      const event = await this.prisma.event.findUnique({
        where: { id: +request.params.eventId }
      });
      const organizer = await this.prisma.organizer.findUnique({
        where: { userId: request.user.id }
      })

      if (organizer && event.organizerId === organizer.id) {
        return true;
      } else {
        throw new ForbiddenException('Only the organizer of this event can perform this operation');
      }
    } catch (error) {
      throw error;
    }
  }
}

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