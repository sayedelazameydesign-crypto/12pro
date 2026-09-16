#!/usr/bin/env node
/**
 * Latency benchmark.
 *
 * Previously this generated 200 samples from Math.random() and hardcoded
 * status:'PASS' without ever comparing them to its own thresholds. Random numbers
 * are not a measurement of anything, and an unevaluated threshold is not a gate.
 *
 * It now measures a REAL in-process code path - the genetic identity fingerprint
 * computation, which is on the certification critical path - evaluates the declared
 * thresholds, and reports FAIL when they are exceeded.
 */
import fs from 'fs';
import path from 'path';

const outputPath = process.argv.find((a) => a.startsWith('--output'))?.split('=')[1] || 'certification/benchmarks/latency.json';
const commit = process.env.GITHUB_SHA || null;
const SAMPLES = 25;
const THRESHOLDS = { p95_max_ms: 2000, p99_max_ms: 4000, mean_max_ms: 1500 };

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

async function measure() {
  // Real work: compute the genetic fingerprint of this repository.
  const { generateGeneticIdentity } = await import('../../packages/identity/src/index.ts');
  const root = path.resolve(import.meta.dirname, '..', '..');

  const durations = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = process.hrtime.bigint();
    generateGeneticIdentity({ root });
    const t1 = process.hrtime.bigint();
    durations.push(Number(t1 - t0) / 1e6);
  }
  return { durations, subject: 'generateGeneticIdentity (full repository genome + merkle + fingerprint)' };
}

async function run() {
  console.log('[benchmark:latency] measuring real in-process latency...');

  let measurements;
  try {
    measurements = await measure();
  } catch (err) {
    const result = {
      benchmark: 'latency',
      commit,
      timestamp: new Date().toISOString(),
      status: 'NOT_MEASURED',
      reason: `measurement failed: ${err.message}`,
      thresholds: THRESHOLDS,
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.error(`[benchmark:latency] NOT_MEASURED: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const d = measurements.durations;
  const metrics = {
    p50_ms: percentile(d, 50),
    p95_ms: percentile(d, 95),
    p99_ms: percentile(d, 99),
    mean_ms: d.reduce((a, b) => a + b, 0) / d.length,
    min_ms: Math.min(...d),
    max_ms: Math.max(...d),
  };

  // Actually evaluate the thresholds. This is the part that was missing.
  const violations = [];
  if (metrics.p95_ms > THRESHOLDS.p95_max_ms) violations.push(`p95 ${metrics.p95_ms.toFixed(1)}ms > ${THRESHOLDS.p95_max_ms}ms`);
  if (metrics.p99_ms > THRESHOLDS.p99_max_ms) violations.push(`p99 ${metrics.p99_ms.toFixed(1)}ms > ${THRESHOLDS.p99_max_ms}ms`);
  if (metrics.mean_ms > THRESHOLDS.mean_max_ms) violations.push(`mean ${metrics.mean_ms.toFixed(1)}ms > ${THRESHOLDS.mean_max_ms}ms`);

  const result = {
    benchmark: 'latency',
    commit,
    timestamp: new Date().toISOString(),
    subject: measurements.subject,
    samples: d.length,
    metrics,
    thresholds: THRESHOLDS,
    violations,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`[benchmark:latency] ${result.subject}`);
  console.log(`[benchmark:latency] p50=${metrics.p50_ms.toFixed(1)}ms p95=${metrics.p95_ms.toFixed(1)}ms p99=${metrics.p99_ms.toFixed(1)}ms mean=${metrics.mean_ms.toFixed(1)}ms`);
  console.log(`[benchmark:latency] ${result.status}${violations.length ? ` - ${violations.join('; ')}` : ''}`);
  if (violations.length > 0) process.exitCode = 1;
}

run();
