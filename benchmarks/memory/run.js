#!/usr/bin/env node
/**
 * Memory benchmark.
 *
 * Measures real process memory after performing real work (a full genome
 * computation), and evaluates the declared threshold instead of hardcoding PASS.
 */
import fs from 'fs';
import path from 'path';

const outputPath = process.argv.find((a) => a.startsWith('--output'))?.split('=')[1] || 'certification/benchmarks/memory.json';
const commit = process.env.GITHUB_SHA || null;
const THRESHOLDS = { heapUsedMB_max: 500, rssMB_max: 1024 };

async function run() {
  console.log('[benchmark:memory] measuring real heap after genome computation...');

  const before = process.memoryUsage();
  let subject = 'idle';
  try {
    const { generateGeneticIdentity } = await import('../../packages/identity/src/index.ts');
    const root = path.resolve(import.meta.dirname, '..', '..');
    // Hold the result so the allocation is genuinely live when we measure.
    const generated = generateGeneticIdentity({ root });
    subject = `generateGeneticIdentity (${generated.record.manifest.files.leafCount} leaves retained)`;
    if (!generated.record.manifest.fingerprint) throw new Error('no fingerprint produced');
  } catch (err) {
    const result = {
      benchmark: 'memory',
      commit,
      timestamp: new Date().toISOString(),
      status: 'NOT_MEASURED',
      reason: `measurement failed: ${err.message}`,
      thresholds: THRESHOLDS,
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.error(`[benchmark:memory] NOT_MEASURED: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const after = process.memoryUsage();
  const metrics = {
    heapUsedMB: after.heapUsed / 1024 / 1024,
    heapTotalMB: after.heapTotal / 1024 / 1024,
    rssMB: after.rss / 1024 / 1024,
    externalMB: after.external / 1024 / 1024,
    heapDeltaMB: (after.heapUsed - before.heapUsed) / 1024 / 1024,
  };

  const violations = [];
  if (metrics.heapUsedMB > THRESHOLDS.heapUsedMB_max) violations.push(`heapUsed ${metrics.heapUsedMB.toFixed(1)}MB > ${THRESHOLDS.heapUsedMB_max}MB`);
  if (metrics.rssMB > THRESHOLDS.rssMB_max) violations.push(`rss ${metrics.rssMB.toFixed(1)}MB > ${THRESHOLDS.rssMB_max}MB`);

  const result = {
    benchmark: 'memory',
    commit,
    timestamp: new Date().toISOString(),
    subject,
    metrics,
    thresholds: THRESHOLDS,
    violations,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`[benchmark:memory] heapUsed=${metrics.heapUsedMB.toFixed(1)}MB rss=${metrics.rssMB.toFixed(1)}MB delta=${metrics.heapDeltaMB.toFixed(1)}MB`);
  console.log(`[benchmark:memory] ${result.status}${violations.length ? ` - ${violations.join('; ')}` : ''}`);
  if (violations.length > 0) process.exitCode = 1;
}

run();
