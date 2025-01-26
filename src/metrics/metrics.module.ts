import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Registry } from 'prom-client';
import { Secrets } from '../common/env';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: Registry,
      useFactory: () => {
        const registry = new Registry();
        registry.setDefaultLabels({ app: Secrets.APP_NAME }); 
        return registry;
      }
    },
    {
      provide: MetricsService,
      useFactory: (registry: Registry) => {
        return new MetricsService(registry);
      },
      inject: [Registry]
    }
  ],
  exports: [
    Registry,
    MetricsService
  ]
})
export class MetricsModule {}
