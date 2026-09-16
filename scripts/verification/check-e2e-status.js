#!/usr/bin/env node
/**
 * Report the HONEST status of the E2E suite.
 *
 * This exists because the E2E job previously wrote
 *     || echo '{"status":"PASS","note":"e2e placeholder"}' > certification/reports/e2e.json
 * i.e. it fabricated a passing certification artifact when the suite did not run.
 *
 * The suite in tests/e2e/ is a placeholder: its only assertion is a tautology and it
 * starts no API server. This script detects that structurally and writes
 * status:"PARTIAL". It never writes PASS for a placeholder, and it exits 0 because
 * a truthfully-reported partial is not a failure - claiming full coverage would be.
 *
 * Usage:
 *   node scripts/verification/check-e2e-status.js [--out=certification/reports/e2e.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { e2eStatus } from '../certification/lib/inspect.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const outArg = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
const OUT = resolve(outArg ?? 'certification/reports/e2e.json');

function resolveCommit() {
  if (process.env.GITHUB_SHA) return { commit: process.env.GITHUB_SHA.trim(), source: 'GITHUB_SHA' };
  const arg = process.argv.find((a) => a.startsWith('--commit='))?.split('=')[1];
  if (arg) return { commit: arg.trim(), source: 'argument' };
  try {
    return { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf-8' }).trim(), source: 'git-rev-parse' };
  } catch {
    return { commit: null, source: 'unbound' };
  }
}

const { commit, source } = resolveCommit();
const result = e2eStatus(ROOT);

const artifact = {
  report: 'e2e',
  /** PARTIAL when the suite is a placeholder. Never PASS for a tautological test. */
  status: result.status === 'MEASURED' ? 'PASS' : result.status,
  commit,
  commitSource: source,
  timestamp: new Date().toISOString(),
  generator: 'scripts/verification/check-e2e-status.js',
  summary: {
    total: result.detection.files.length,
    passed: null,
    failed: null,
    skipped: null,
    placeholderFiles: result.detection.placeholders.length,
    realFiles: result.detection.real.length,
  },
  files: result.detection.files,
  placeholders: result.detection.placeholders,
  realFiles: result.detection.real,
  reason: result.reason,
  previousBehaviour:
    'The E2E workflow step previously wrote {"status":"PASS","note":"e2e placeholder"} into this file when the suite failed to run. ' +
    'That fabricated a passing certification artifact. It has been removed.',
  requiredForFullPass: [
    'a real API server started for the duration of the test run',
    'playwright browsers installed in CI',
    'assertions against actual responses and observable side effects, not expect(true).toBeTruthy()',
  ],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');

console.log(`[e2e-status] status       : ${artifact.status}`);
console.log(`[e2e-status] files        : ${artifact.summary.total} (${artifact.summary.realFiles} real, ${artifact.summary.placeholderFiles} placeholder)`);
console.log(`[e2e-status] commit       : ${commit ?? '(unbound)'} [${source}]`);
console.log(`[e2e-status] reason       : ${artifact.reason}`);
console.log(`[e2e-status] wrote        : ${OUT}`);

if (artifact.status === 'NOT_CERTIFIED') {
  console.error('[e2e-status] no E2E suite exists at all - that is not a partial, it is an absence.');
  process.exit(1);
}
process.exit(0);
