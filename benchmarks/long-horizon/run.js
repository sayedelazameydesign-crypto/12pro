#!/usr/bin/env node
/**
 * Long-horizon benchmark.
 *
 * This benchmark previously wrote literal constants:
 *     missionsCompleted: 10, avgSteps: 23.4, failureRate: 0.05, status: 'PASS'
 * None of those numbers came from running anything. Publishing them as a passing
 * benchmark is fabrication, so they are removed.
 *
 * A real long-horizon benchmark needs an agent loop executing multi-step missions
 * against a live model provider. That requires credentials and a spend budget, and
 * this repository enforces MAX_SPEND=0. Until such a run has actually happened, the
 * honest status is NOT_MEASURED.
 *
 * NOT_MEASURED is reported loudly: the consuming gate (G8) treats it as PARTIAL and
 * never as PASS, and the reason is recorded in the artifact.
 */
import fs from 'fs';
import path from 'path';

const outputPath = process.argv.find((a) => a.startsWith('--output'))?.split('=')[1] || 'certification/benchmarks/long-horizon.json';
const commit = process.env.GITHUB_SHA || null;

const result = {
  benchmark: 'long-horizon',
  commit,
  timestamp: new Date().toISOString(),
  status: 'NOT_MEASURED',
  measured: false,
  metrics: null,
  reason:
    'A real long-horizon benchmark requires an agent loop executing multi-step missions against a live provider. ' +
    'That needs credentials and a non-zero spend budget, and this repository enforces MAX_SPEND=0. ' +
    'No mission has actually been executed, so no number is reported.',
  previousBehaviour:
    'Earlier revisions of this file emitted hardcoded constants (missionsCompleted: 10, avgSteps: 23.4, failureRate: 0.05) ' +
    'with status PASS. Those values were never measured and have been removed.',
  requiredToMeasure: [
    'an agent runtime able to execute a >=10 step mission end to end',
    'a provider with a real credential and an explicitly approved spend budget',
    'a recorded mission journal to derive step counts and failure rate from',
  ],
  relatedEvidence: 'evaluations/long-horizon/mission-10-steps.eval.ts (a structural evaluation, not a timing benchmark)',
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`[benchmark:long-horizon] NOT_MEASURED - ${result.reason}`);
