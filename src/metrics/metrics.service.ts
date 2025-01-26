import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly twoFactorAuthMetric: Gauge<string> = new Gauge({
    name: 'two_fa_enabled_users',
    help: 'Total number of users that enabled 2FA',
    registers: [this.registry]
  });

  public readonly unsuccessfulTransfersCounter: Counter<string> = new Counter({
    name: 'transaction_refunds',
    help: 'Total number of transaction refunds',
    registers: [this.registry]
  });

  public readonly transactionRefundCounter: Counter<string> = new Counter({
    name: 'unsuccessful_transfers',
    help: 'Total number of unsuccessful transfers',
    registers: [this.registry]
  });

  constructor(private readonly registry: Registry) { };

  async getMetrics(): Promise<Record<string, any>> {
    return await this.registry.getMetricsAsJSON();
  }

  updateTwoFactorAuthMetric(action: 'dec' | 'inc'): void {
    action === 'dec' ? this.twoFactorAuthMetric.dec() : this.twoFactorAuthMetric.inc();
  }

  incrementTransactionRefunds(): void {
    this.transactionRefundCounter.inc();
  }

  incrementUnsuccessfulTransfers(): void {
    this.unsuccessfulTransfersCounter.inc();
  }
}
