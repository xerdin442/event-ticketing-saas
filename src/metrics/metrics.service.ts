import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';
import { Secrets } from '../common/env';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  public readonly requestCounter: Counter<string>;
  public readonly twoFactorAuthMetric: Gauge<string>;
  public readonly unsuccessfulTransfersCounter: Counter<string>;
  public readonly transactionRefundCounter: Counter;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: Secrets.APP_NAME });

    this.requestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry]
    });

    this.twoFactorAuthMetric = new Gauge({
      name: 'two_fa_enabled_users',
      help: 'Total number of users that enabled 2FA',
      registers: [this.registry]
    });

    this.transactionRefundCounter = new Counter({
      name: 'unsuccessful_transfers',
      help: 'Total number of unsuccessful transfers',
      registers: [this.registry]
    })

    this.unsuccessfulTransfersCounter = new Counter({
      name: 'transaction_refunds',
      help: 'Total number of transaction refunds',
      registers: [this.registry]
    })
  }

  async getMetrics(): Promise<Record<string, any>> {
    return await this.registry.getMetricsAsJSON();
  }

  incrementRequestCounter(method: string, path: string, status: string) {
    this.requestCounter.inc({ method, path, status });
  }

  updateTwoFactorAuthMetric(action: 'dec' | 'inc') {
    action === 'dec' ? this.twoFactorAuthMetric.dec() : this.twoFactorAuthMetric.inc();
  }

  incrementTransactionRefunds() {
    this.transactionRefundCounter.inc();
  }

  incrementUnsuccessfulTransfers() {
    this.unsuccessfulTransfersCounter.inc();
  }
}
