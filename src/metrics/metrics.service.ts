import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly counter: { [name: string]: Counter<string> } = {};
  private readonly gauge: { [name: string]: Gauge<string> } = {};

  constructor(private readonly registry: Registry) { };

  async getMetrics(): Promise<Record<string, any>> {
    return await this.registry.getMetricsAsJSON();
  }

  updateGauge(name: string, action: 'dec' | 'inc'): void {
    if (!this.gauge[name]) {
      this.gauge[name] = new Gauge({
        name,
        help: `Total number of ${name}`.replace(/_/g, ' '),
        registers: [this.registry]
      })
    };

    action === 'dec' ? this.gauge[name].dec() : this.gauge[name].inc();
  }

  incrementCounter(name: string): void {
    if (!this.counter[name]) {
      this.counter[name] = new Counter({
        name,
        help: `Total number of ${name}`.replace(/_/g, ' '),
        registers: [this.registry]
      })
    };

    this.counter[name].inc();
  }
}
