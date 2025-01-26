import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Registry } from 'prom-client';
import { Secrets } from '../common/env';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: Registry,
      useFactory: () => {
        const registry = new Registry();
        registry.setDefaultLabels({ app: Secrets.APP_NAME }); 
        return registry;
      }
    }
  ],
  exports: [
    Registry,
    MetricsService
  ]
})
export class MetricsModule {}
