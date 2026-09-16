import { describe, it, expect } from 'vitest';
import {
  aggregateHealth,
  thresholdSignal,
  unknownSignal,
  runHealthChecks,
} from '@agi-system/autonomy';
import type { HealthSignal } from '@agi-system/autonomy';

function signal(name: string, status: HealthSignal['status']): HealthSignal {
  return { name, status, detail: `${name}=${status}`, checkedAt: new Date().toISOString() };
}

describe('autonomy / health checks', () => {
  it('never counts UNKNOWN as healthy', () => {
    const report = aggregateHealth([signal('a', 'HEALTHY'), signal('b', 'UNKNOWN')]);
    expect(report.status).toBe('UNKNOWN');
    expect(report.healthyCount).toBe(1);
    expect(report.unknownCount).toBe(1);
  });

  it('is UNKNOWN when no signals were collected at all', () => {
    expect(aggregateHealth([]).status).toBe('UNKNOWN');
  });

  it('lets the worst signal win', () => {
    expect(aggregateHealth([signal('a', 'HEALTHY'), signal('b', 'DEGRADED')]).status).toBe('DEGRADED');
    expect(aggregateHealth([signal('a', 'DEGRADED'), signal('b', 'UNHEALTHY')]).status).toBe('UNHEALTHY');
  });

  it('is HEALTHY only when every signal is HEALTHY', () => {
    expect(aggregateHealth([signal('a', 'HEALTHY'), signal('b', 'HEALTHY')]).status).toBe('HEALTHY');
  });

  it('counts every bucket consistently with the signal list length', () => {
    const signals = [signal('a', 'HEALTHY'), signal('b', 'DEGRADED'), signal('c', 'UNHEALTHY'), signal('d', 'UNKNOWN')];
    const report = aggregateHealth(signals);
    expect(report.healthyCount + report.degradedCount + report.unhealthyCount + report.unknownCount).toBe(signals.length);
  });

  describe('thresholdSignal', () => {
    it('is HEALTHY at or below the threshold when lower is better', () => {
      expect(thresholdSignal({ name: 'errRate', value: 0.01, threshold: 0.05 }).status).toBe('HEALTHY');
      expect(thresholdSignal({ name: 'errRate', value: 0.05, threshold: 0.05 }).status).toBe('HEALTHY');
    });

    it('degrades between the threshold and threshold * degradeFactor', () => {
      const s = thresholdSignal({ name: 'errRate', value: 0.06, threshold: 0.05, degradeFactor: 1.5 });
      expect(s.status).toBe('DEGRADED');
    });

    it('is UNHEALTHY beyond the degrade band', () => {
      expect(thresholdSignal({ name: 'errRate', value: 0.5, threshold: 0.05 }).status).toBe('UNHEALTHY');
    });

    it('inverts correctly when higher is better', () => {
      expect(thresholdSignal({ name: 'uptime', value: 0.999, threshold: 0.99, lowerIsBetter: false }).status).toBe('HEALTHY');
      expect(thresholdSignal({ name: 'uptime', value: 0.5, threshold: 0.99, lowerIsBetter: false }).status).toBe('UNHEALTHY');
    });

    it('is UNKNOWN for a non-finite measurement rather than guessing', () => {
      expect(thresholdSignal({ name: 'x', value: Number.NaN, threshold: 1 }).status).toBe('UNKNOWN');
    });
  });

  it('converts a throwing probe into UNKNOWN instead of a pass', async () => {
    const report = await runHealthChecks([
      { name: 'ok', check: () => signal('ok', 'HEALTHY') },
      {
        name: 'boom',
        check: () => {
          throw new Error('probe exploded');
        },
      },
    ]);
    expect(report.status).toBe('UNKNOWN');
    expect(report.unknownCount).toBe(1);
    const boom = report.signals.find((s) => s.name === 'boom');
    expect(boom?.status).toBe('UNKNOWN');
    expect(boom?.detail).toContain('probe exploded');
  });

  it('awaits async probes', async () => {
    const report = await runHealthChecks([
      { name: 'async', check: async () => signal('async', 'HEALTHY') },
    ]);
    expect(report.status).toBe('HEALTHY');
  });

  it('unknownSignal is explicitly UNKNOWN with a reason', () => {
    const s = unknownSignal('liveProvider', 'never actually contacted');
    expect(s.status).toBe('UNKNOWN');
    expect(s.detail).toContain('never actually contacted');
  });
});
