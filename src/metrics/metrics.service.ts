import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly counter: { [name: string]: Counter<string> } = {};
  private readonly gauge: { [name: string]: Gauge<string> } = {};

  constructor(private readonly registry: Registry) {}

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }

  updateGauge(
    name: string,
    action: 'dec' | 'inc',
    labels?: string[],
    value = 1,
  ): void {
    if (!this.gauge[name]) {
      this.gauge[name] = new Gauge({
        name,
        help: name.toUpperCase(),
        labelNames: labels || [],
        registers: [this.registry],
      });
    }

    const gauge: Gauge = this.gauge[name];

    if (labels) {
      action === 'dec'
        ? gauge.labels(...labels).dec(value)
        : gauge.labels(...labels).inc(value);
    } else {
      action === 'dec' ? gauge.dec(value) : gauge.inc(value);
    }
  }

  incrementCounter(name: string, labels?: string[], value = 1): void {
    if (!this.counter[name]) {
      this.counter[name] = new Counter({
        name,
        help: name.toUpperCase(),
        labelNames: labels || [],
        registers: [this.registry],
      });
    }

    labels
      ? this.counter[name].labels(...labels).inc(value)
      : this.counter[name].inc(value);
  }
}
