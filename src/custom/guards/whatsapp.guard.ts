import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Secrets } from "@src/common/secrets";
import { REDIS_CLIENT } from "@src/redis/redis.module";
import { RedisClientType } from "redis";

@Injectable()
export class WhatsappApiKeyGuard implements CanActivate {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();

      const header = request.headers['authorization'];
      if (!header) return null;
      const apiKey = header.split(' ')[1];

      // Reject request if API key is missing
      if (!apiKey) throw new UnauthorizedException('Missing API key');

      // Reject request if API key is invalid
      if (apiKey !== Secrets.WHATSAPP_BOT_API_KEY) {
        throw new UnauthorizedException('Invalid API key');
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}