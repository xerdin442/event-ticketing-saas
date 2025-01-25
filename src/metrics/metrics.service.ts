import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';
import { Secrets } from '../common/env';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;
  public readonly twoFactorAuthMetric: Gauge<string>;
  public readonly unsuccessfulTransfersCounter: Counter<string>;
  public readonly transactionRefundCounter: Counter<string>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ app: Secrets.APP_NAME });

    this.twoFactorAuthMetric = new Gauge({
      name: 'two_fa_enabled_users',
      help: 'Total number of users that enabled 2FA',
      registers: [this.registry]
    });

    this.transactionRefundCounter = new Counter({
      name: 'transaction_refunds',
      help: 'Total number of transaction refunds',
      registers: [this.registry]
    })

    this.unsuccessfulTransfersCounter = new Counter({
      name: 'unsuccessful_transfers',
      help: 'Total number of unsuccessful transfers',
      registers: [this.registry]
    })
  }

  async getMetrics(): Promise<Record<string, any>> {
    return await this.registry.getMetricsAsJSON();
  }

  updateTwoFactorAuthMetric(action: 'dec' | 'inc'): void {
    console.log('Incrementing two factor auth metric')
    action === 'dec' ? this.twoFactorAuthMetric.dec() : this.twoFactorAuthMetric.inc();
  }

  incrementTransactionRefunds(): void {
    this.transactionRefundCounter.inc();
  }

  incrementUnsuccessfulTransfers(): void {
    this.unsuccessfulTransfersCounter.inc();
  }
}
