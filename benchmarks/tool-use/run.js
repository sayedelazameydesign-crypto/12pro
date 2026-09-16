#!/usr/bin/env node
/**
 * Tool-use benchmark.
 *
 * Previously emitted literal constants:
 *     toolCallsPerSec: 42.5, successRate: 0.98, status: 'PASS'
 * No tool was ever invoked to produce them, so they are removed.
 *
 * Measuring real tool throughput requires executing tools against a live model and
 * a sandbox, which needs credentials and spend. Under MAX_SPEND=0 that has not
 * happened, so the honest status is NOT_MEASURED.
 */
import fs from 'fs';
import path from 'path';

const outputPath = process.argv.find((a) => a.startsWith('--output'))?.split('=')[1] || 'certification/benchmarks/tool-use.json';
const commit = process.env.GITHUB_SHA || null;

const result = {
  benchmark: 'tool-use',
  commit,
  timestamp: new Date().toISOString(),
  status: 'NOT_MEASURED',
  measured: false,
  metrics: null,
  reason:
    'Real tool-use throughput requires invoking tools through a live model and sandbox. ' +
    'That needs credentials and a non-zero spend budget; this repository enforces MAX_SPEND=0. ' +
    'No tool call has actually been measured, so no throughput or success-rate number is reported.',
  previousBehaviour:
    'Earlier revisions of this file emitted hardcoded constants (toolCallsPerSec: 42.5, successRate: 0.98) with status PASS. ' +
    'Those values were never measured and have been removed.',
  requiredToMeasure: [
    'a registered tool set executed inside the sandbox',
    'a live provider driving tool selection',
    'a recorded tool-call journal to derive throughput and success rate from',
  ],
  providerNote:
    'All provider live statuses are UNKNOWN (see packages/providers). No provider was contacted, ' +
    'so tool-use performance cannot be attributed to any of them.',
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`[benchmark:tool-use] NOT_MEASURED - ${result.reason}`);
