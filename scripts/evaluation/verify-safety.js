#!/usr/bin/env node
/**
 * Verify the Safety Gate (G14) - 2026 critical, 100% pass required.
 *
 * Previously this read a report whose shape it did not actually validate and could
 * therefore pass vacuously: when the fields it looked for were absent (for example
 * when the report was raw vitest JSON rather than the certification shape) it fell
 * through to a pass. It also never compared the report's commit with anything.
 *
 * It now:
 *   - understands BOTH the certification report shape and raw vitest JSON output
 *   - fails when the report is missing, unparsable, or reports zero tests
 *   - requires 100% pass, and treats anything less as FAIL (never PARTIAL)
 *   - requires the report to be bound to the commit being certified in CI
 *   - writes G14 from what it measured rather than trusting a pre-existing G14
 *
 * Exit codes: 0 = safety gate holds, 1 = failed, 2 = usage/environment error.
 */
import fs from 'fs';
import { execFileSync } from 'node:child_process';

const strict = process.argv.includes('--strict');
const inCi = process.env.CI === 'true';
const requireBinding = process.argv.includes('--require-commit-binding') || inCi;

const reportPath =
  process.argv.find((a) => a.startsWith('--report'))?.split('=')[1] ?? 'certification/reports/evaluations/safety.json';
const gatePath = process.argv.find((a) => a.startsWith('--gate'))?.split('=')[1] ?? 'certification/gates/G14.json';

const IS_SHA = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);

function resolveCommit() {
  const arg = process.argv.find((a) => a.startsWith('--commit'))?.split('=')[1];
  if (arg) return { commit: arg.trim(), source: 'argument' };
  if (process.env.GITHUB_SHA) return { commit: process.env.GITHUB_SHA.trim(), source: 'GITHUB_SHA' };
  try {
    return { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim(), source: 'git-rev-parse' };
  } catch {
    return { commit: null, source: 'unbound' };
  }
}

const { commit: COMMIT, source: COMMIT_SOURCE } = resolveCommit();

if (requireBinding && !IS_SHA(COMMIT)) {
  console.error(`[safety] FATAL: binding required but commit is not a 40-hex SHA (got ${String(COMMIT)} from ${COMMIT_SOURCE}).`);
  process.exit(2);
}

console.log(`[safety] commit under certification: ${COMMIT ?? '(unbound)'} [${COMMIT_SOURCE}]`);
console.log(`[safety] report                    : ${reportPath}`);

if (!fs.existsSync(reportPath)) {
  console.error(`[safety] FAIL: no safety report at ${reportPath}.`);
  console.error('[safety] A missing report is a failed gate, not a passed one.');
  writeGate('NOT_CERTIFIED', null, null, null, 'safety report is missing');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
} catch (err) {
  console.error(`[safety] FAIL: safety report is unparsable: ${err.message}`);
  writeGate('NOT_CERTIFIED', null, null, null, `unparsable report: ${err.message}`);
  process.exit(1);
}

/** Accept either the certification shape or raw vitest JSON. */
function extractCounts(data) {
  if (data.summary && typeof data.summary.total === 'number') {
    return {
      total: data.summary.total,
      passed: data.summary.passed ?? 0,
      failed: data.summary.failed ?? 0,
      shape: 'certification-report',
    };
  }
  if (typeof data.numTotalTests === 'number') {
    return {
      total: data.numTotalTests,
      passed: data.numPassedTests ?? 0,
      failed: data.numFailedTests ?? 0,
      shape: 'vitest-json',
    };
  }
  return null;
}

const counts = extractCounts(report);

if (!counts) {
  console.error('[safety] FAIL: the report contains neither `summary.total` nor `numTotalTests`.');
  console.error(`[safety] Found keys: ${Object.keys(report).join(', ')}`);
  console.error('[safety] Refusing to infer a pass from an unrecognized shape.');
  writeGate('NOT_CERTIFIED', null, null, null, 'report shape is not recognized');
  process.exit(1);
}

console.log(`[safety] report shape              : ${counts.shape}`);
console.log(`[safety] tests                     : ${counts.passed}/${counts.total} passed, ${counts.failed} failed`);

const failures = [];

if (counts.total === 0) {
  failures.push('the safety suite reported zero tests - an empty suite is not evidence of safety');
}
if (counts.failed > 0) {
  failures.push(`${counts.failed} safety test(s) failed`);
}
if (counts.passed !== counts.total) {
  failures.push(`safety gate requires 100% pass, got ${counts.total > 0 ? ((counts.passed / counts.total) * 100).toFixed(1) : 0}%`);
}

// Commit binding: a safety report about a different commit says nothing about this one.
const reportCommit = report.commit ?? null;
if (requireBinding) {
  if (reportCommit !== COMMIT) {
    failures.push(`report is bound to ${String(reportCommit)} but the commit being certified is ${COMMIT}`);
  }
} else if (reportCommit !== null && reportCommit !== COMMIT) {
  console.warn(`[safety] WARNING: report commit ${String(reportCommit).slice(0, 12)}... differs from ${String(COMMIT).slice(0, 12)}...`);
}

const status = failures.length === 0 ? 'PASS' : counts.total === 0 || counts.shape === undefined ? 'NOT_CERTIFIED' : 'FAIL';
const score = counts.total > 0 ? counts.passed / counts.total : 0;

writeGate(status, counts.total, counts.passed, counts.failed, failures.length ? failures.join('; ') : `100% of ${counts.total} safety test(s) passed`, score, reportPath);

if (failures.length > 0) {
  console.error('');
  for (const failure of failures) console.error(`[safety] FAIL ${failure}`);
  console.error(`[safety] G14 Safety Gate: ${status}`);
  process.exit(1);
}

console.log(`[safety] G14 Safety Gate PASS - 100% of ${counts.total} safety case(s) passed (score ${score.toFixed(3)})`);
if (strict) console.log('[safety] strict mode: no warnings were promoted because none were raised');
process.exit(0);

function writeGate(statusValue, total, passed, failed, reason, scoreValue = null, evidenceSource = null) {
  const gate = {
    gate: 'G14',
    name: 'Safety Evaluation - 100% PASS required',
    description:
      'Safety evaluations must pass completely. Anything less than 100% is FAIL; a missing or empty report is NOT_CERTIFIED. Neither is ever reported as PASS.',
    status: statusValue,
    commit: COMMIT,
    commitSource: COMMIT_SOURCE,
    timestamp: new Date().toISOString(),
    generator: 'scripts/evaluation/verify-safety.js',
    tests: total,
    passed,
    failed,
    score: scoreValue,
    reason,
    evidenceSource,
    required: true,
    blocking: true,
  };
  try {
    fs.mkdirSync('certification/gates', { recursive: true });
    fs.writeFileSync(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
    console.log(`[safety] wrote ${gatePath} (status ${statusValue})`);
  } catch (err) {
    console.error(`[safety] could not write ${gatePath}: ${err.message}`);
  }
}
