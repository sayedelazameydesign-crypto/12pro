#!/usr/bin/env node
/**
 * Planning / graph-work benchmark.
 *
 * Measures the real cost of building the genome graph (workspace discovery, export
 * extraction, Merkle construction) and evaluates a declared threshold.
 */
import fs from 'fs';
import path from 'path';

const outputPath = process.argv.find((a) => a.startsWith('--output'))?.split('=')[1] || 'certification/benchmarks/planning.json';
const commit = process.env.GITHUB_SHA || null;
const SAMPLES = 15;
const THRESHOLDS = { mean_max_ms: 1500, p95_max_ms: 2500 };

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

async function run() {
  console.log('[benchmark:planning] measuring genome graph construction...');

  let buildSystemGenome;
  let scanRepository;
  let buildMerkleTree;
  let root;
  try {
    const identity = await import('../../packages/identity/src/index.ts');
    buildSystemGenome = identity.buildSystemGenome;
    scanRepository = identity.scanRepository;
    buildMerkleTree = identity.buildMerkleTree;
    root = path.resolve(import.meta.dirname, '..', '..');
  } catch (err) {
    console.error(`[benchmark:planning] NOT_MEASURED: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const durations = [];
  let leafCount = 0;
  let packageCount = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = process.hrtime.bigint();
    const scan = scanRepository({ root });
    const genome = buildSystemGenome({ root, leaves: scan.leaves });
    const tree = buildMerkleTree(scan.leaves);
    const t1 = process.hrtime.bigint();
    if (!tree.root) throw new Error('no merkle root');
    durations.push(Number(t1 - t0) / 1e6);
    leafCount = scan.leaves.length;
    packageCount = genome.packages.length;
  }

  const metrics = {
    mean_ms: durations.reduce((a, b) => a + b, 0) / durations.length,
    p95_ms: percentile(durations, 95),
    min_ms: Math.min(...durations),
    max_ms: Math.max(...durations),
  };

  const violations = [];
  if (metrics.mean_ms > THRESHOLDS.mean_max_ms) violations.push(`mean ${metrics.mean_ms.toFixed(1)}ms > ${THRESHOLDS.mean_max_ms}ms`);
  if (metrics.p95_ms > THRESHOLDS.p95_max_ms) violations.push(`p95 ${metrics.p95_ms.toFixed(1)}ms > ${THRESHOLDS.p95_max_ms}ms`);

  const result = {
    benchmark: 'planning',
    commit,
    timestamp: new Date().toISOString(),
    subject: `scan + buildSystemGenome + buildMerkleTree (${leafCount} leaves, ${packageCount} packages)`,
    samples: durations.length,
    metrics,
    thresholds: THRESHOLDS,
    violations,
    status: violations.length === 0 ? 'PASS' : 'FAIL',
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`[benchmark:planning] mean=${metrics.mean_ms.toFixed(1)}ms p95=${metrics.p95_ms.toFixed(1)}ms over ${SAMPLES} samples`);
  console.log(`[benchmark:planning] ${result.status}${violations.length ? ` - ${violations.join('; ')}` : ''}`);
  if (violations.length > 0) process.exitCode = 1;
}

run();
