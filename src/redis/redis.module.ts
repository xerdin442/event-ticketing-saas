import { Global, Module } from '@nestjs/common';
import { Secrets } from '@src/common/secrets';
import { createClient } from 'redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT, 
      useFactory: async () => {
        // Initialize Redis client
        const client = createClient({ url: Secrets.REDIS_URL });
        await client.connect();

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT], 
})
export class RedisModule {}
