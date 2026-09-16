/**
 * Health checks.
 *
 * Rule that matters most: an UNKNOWN signal is never counted as healthy. A check
 * that could not run is reported as UNKNOWN and prevents promotion, rather than
 * being silently treated as a pass. This is the same failure mode as a CI step
 * whose failure is swallowed by `|| echo`.
 */
import type { HealthReport, HealthSignal, HealthStatus } from './types.ts';

export interface HealthProbe {
  name: string;
  /** Return a signal, or throw - a throw is recorded as UNKNOWN, never as HEALTHY. */
  check(): HealthSignal | Promise<HealthSignal>;
}

/** Build a quantitative signal by comparing a measured value to a threshold. */
export function thresholdSignal(input: {
  name: string;
  value: number;
  threshold: number;
  /** When true, LOWER is better (e.g. error rate, latency). */
  lowerIsBetter?: boolean;
  /** Value below/above which the signal is DEGRADED rather than UNHEALTHY. */
  degradeFactor?: number;
  detail?: string;
}): HealthSignal {
  const { name, value, threshold, detail } = input;
  const lowerIsBetter = input.lowerIsBetter ?? true;
  const degradeFactor = input.degradeFactor ?? 1.5;

  let status: HealthStatus;
  if (!Number.isFinite(value)) {
    status = 'UNKNOWN';
  } else if (lowerIsBetter) {
    status = value <= threshold ? 'HEALTHY' : value <= threshold * degradeFactor ? 'DEGRADED' : 'UNHEALTHY';
  } else {
    status =
      value >= threshold ? 'HEALTHY' : value >= threshold / degradeFactor ? 'DEGRADED' : 'UNHEALTHY';
  }

  return {
    name,
    status,
    value,
    threshold,
    detail: detail ?? `${name}=${value} (threshold ${threshold})`,
    checkedAt: new Date().toISOString(),
  };
}

/** A signal for something that was never actually exercised. */
export function unknownSignal(name: string, detail: string): HealthSignal {
  return { name, status: 'UNKNOWN', detail, checkedAt: new Date().toISOString() };
}

/** Aggregate signals into one report. Worst-case wins; UNKNOWN is never healthy. */
export function aggregateHealth(signals: readonly HealthSignal[]): HealthReport {
  const healthyCount = signals.filter((s) => s.status === 'HEALTHY').length;
  const degradedCount = signals.filter((s) => s.status === 'DEGRADED').length;
  const unhealthyCount = signals.filter((s) => s.status === 'UNHEALTHY').length;
  const unknownCount = signals.filter((s) => s.status === 'UNKNOWN').length;

  let status: HealthStatus;
  if (signals.length === 0) {
    status = 'UNKNOWN';
  } else if (unhealthyCount > 0) {
    status = 'UNHEALTHY';
  } else if (degradedCount > 0) {
    status = 'DEGRADED';
  } else if (unknownCount > 0) {
    // No signal may be promoted to HEALTHY just because nothing failed.
    status = 'UNKNOWN';
  } else {
    status = 'HEALTHY';
  }

  return { status, signals: [...signals], healthyCount, degradedCount, unhealthyCount, unknownCount };
}

/** Run every probe, converting throws into UNKNOWN signals. */
export async function runHealthChecks(probes: readonly HealthProbe[]): Promise<HealthReport> {
  const signals: HealthSignal[] = [];
  for (const probe of probes) {
    try {
      signals.push(await probe.check());
    } catch (err) {
      signals.push(
        unknownSignal(probe.name, `probe threw: ${(err as Error).message}`),
      );
    }
  }
  return aggregateHealth(signals);
}
