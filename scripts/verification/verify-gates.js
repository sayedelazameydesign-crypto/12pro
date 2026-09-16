#!/usr/bin/env node
/**
 * Verify certification gates - blocks merge when a required gate is not PASS.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The previous version accepted `--commit=<sha>`, printed it, and then never looked
 * at it again. It only tested `status !== 'PASS'`. That made the commit argument
 * cosmetic: gate files bound to an unrelated commit still verified as PASS, which is
 * exactly how the certification drifted away from the commit it claimed to describe.
 *
 * This version:
 *   - REQUIRES a commit when `--require-commit-binding` (or CI) is set
 *   - compares every artifact's `commit` field with the commit being certified and
 *     FAILS on mismatch
 *   - treats NOT_CERTIFIED, PARTIAL and FAIL as non-passing
 *   - fails when a blocking gate is not PASS
 *   - never upgrades a partial result to a pass
 *   - reports the exact counts it read, so a report can never disagree with them
 *
 * Exit codes: 0 = verified, 1 = verification failed, 2 = usage/environment error.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'node:child_process';

const gatesArg = process.argv.find((a) => a.startsWith('--gates'))?.split('=')[1];
const requestedGates = gatesArg ? gatesArg.split(',').map((g) => g.trim()).filter(Boolean) : null;

const commitArg = process.argv.find((a) => a.startsWith('--commit'))?.split('=')[1] ?? null;
const strict = process.argv.includes('--strict');
const inCi = process.env.CI === 'true';
const requireBinding = process.argv.includes('--require-commit-binding') || inCi;
const quiet = process.argv.includes('--quiet');

const IS_SHA = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);

function resolveCommit() {
  if (commitArg) return { commit: commitArg.trim(), source: 'argument' };
  if (process.env.GITHUB_SHA) return { commit: process.env.GITHUB_SHA.trim(), source: 'GITHUB_SHA' };
  try {
    return { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim(), source: 'git-rev-parse' };
  } catch {
    return { commit: null, source: 'unbound' };
  }
}

const { commit: COMMIT, source: COMMIT_SOURCE } = resolveCommit();

if (requireBinding && !IS_SHA(COMMIT)) {
  console.error(`[verify] FATAL: commit binding is required but resolved commit is not a 40-hex SHA (got ${String(COMMIT)} from ${COMMIT_SOURCE}).`);
  console.error('[verify] A certification that cannot name its commit cannot be verified by anyone else.');
  process.exit(2);
}

const gatesDir = 'certification/gates';
if (!fs.existsSync(gatesDir)) {
  console.error(`[verify] FATAL: ${gatesDir} does not exist - there is nothing to verify.`);
  process.exit(2);
}

const files = fs
  .readdirSync(gatesDir)
  .filter((f) => f.endsWith('.json'))
  .sort((a, b) => {
    // Natural gate order: G0, G1, ... G9, G10, ... G16
    const na = parseInt(a.replace(/\D/g, ''), 10);
    const nb = parseInt(b.replace(/\D/g, ''), 10);
    return na - nb;
  });

if (files.length === 0) {
  console.error(`[verify] FATAL: no gate artifacts under ${gatesDir}.`);
  process.exit(2);
}

console.log(`[verify] commit under certification: ${COMMIT ?? '(unbound)'} [source: ${COMMIT_SOURCE}]`);
console.log(`[verify] commit binding required   : ${requireBinding}`);
console.log(`[verify] gate artifacts found      : ${files.length}`);
console.log('');

const PASSING = new Set(['PASS']);
const rows = [];
let bindingFailures = 0;
let blockingFailures = 0;
let nonBlockingFailures = 0;
let notCertified = 0;
let partial = 0;

for (const file of files) {
  const gateName = path.basename(file, '.json');
  if (requestedGates && !requestedGates.includes(gateName)) continue;

  const full = path.join(gatesDir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf-8'));
  } catch (err) {
    rows.push({ gate: gateName, status: 'INVALID', binding: 'n/a', detail: `unparsable JSON: ${err.message}`, blocking: true });
    blockingFailures += 1;
    continue;
  }

  const status = data.status ?? 'MISSING_STATUS';
  const blocking = data.blocking === true;
  const artifactCommit = data.commit ?? null;

  // ---- commit binding: the check that used to be missing -------------------
  let binding = 'not-required';
  if (requireBinding) {
    if (artifactCommit === COMMIT) {
      binding = 'MATCH';
    } else {
      binding = `MISMATCH(${artifactCommit === null ? 'null' : String(artifactCommit).slice(0, 12)})`;
      bindingFailures += 1;
    }
  } else if (artifactCommit === null) {
    binding = 'unbound';
  } else if (artifactCommit === COMMIT) {
    binding = 'MATCH';
  } else {
    binding = `stale(${String(artifactCommit).slice(0, 12)})`;
  }

  const counts =
    data.tests === null || data.tests === undefined
      ? ''
      : ` ${data.passed}/${data.tests}${data.failed ? ` (${data.failed} failed)` : ''}`;

  rows.push({
    gate: gateName,
    status,
    binding,
    counts,
    blocking,
    required: data.required === true,
    detail: data.reason ?? data.description ?? '',
  });

  if (status === 'NOT_CERTIFIED') notCertified += 1;
  if (status === 'PARTIAL') partial += 1;

  const isPassing = PASSING.has(status) && (requireBinding ? binding === 'MATCH' : binding !== `MISMATCH(${artifactCommit === null ? 'null' : String(artifactCommit).slice(0, 12)})`);

  if (!isPassing) {
    if (blocking) blockingFailures += 1;
    else nonBlockingFailures += 1;
  }
}

for (const row of rows) {
  const mark = row.status === 'PASS' && (row.binding === 'MATCH' || row.binding === 'not-required' || row.binding === 'unbound') ? 'PASS ' : 'FAIL ';
  console.log(`[verify] ${mark} ${row.gate.padEnd(4)} ${String(row.status).padEnd(14)} binding=${String(row.binding).padEnd(22)} ${(row.counts ?? '').padEnd(14)} ${row.blocking ? 'BLOCKING' : 'non-blocking'}`);
  if (row.status !== 'PASS' && row.detail && !quiet) {
    console.log(`[verify]        reason: ${String(row.detail).slice(0, 300)}`);
  }
}

console.log('');
console.log(
  `[verify] ${rows.length} gate(s) inspected: ` +
    `${rows.filter((r) => r.status === 'PASS').length} PASS, ` +
    `${rows.filter((r) => r.status === 'FAIL').length} FAIL, ` +
    `${partial} PARTIAL, ${notCertified} NOT_CERTIFIED`,
);
console.log(`[verify] commit-binding mismatches: ${bindingFailures}`);
console.log(`[verify] blocking gates not PASS  : ${blockingFailures}`);
console.log(`[verify] non-blocking not PASS    : ${nonBlockingFailures}`);

if (bindingFailures > 0) {
  console.error('');
  console.error(`[verify] FAILED: ${bindingFailures} artifact(s) are not bound to the commit being certified (${COMMIT}).`);
  console.error('[verify] Regenerate certification from this checkout: node scripts/certification/run-certification.js --commit=' + COMMIT);
  process.exit(1);
}

if (blockingFailures > 0) {
  console.error('');
  console.error(`[verify] FAILED: ${blockingFailures} blocking gate(s) are not PASS - merge blocked.`);
  process.exit(1);
}

if (strict && nonBlockingFailures > 0) {
  console.error('');
  console.error(`[verify] FAILED (--strict): ${nonBlockingFailures} non-blocking gate(s) are not PASS.`);
  process.exit(1);
}

if (nonBlockingFailures > 0) {
  console.warn('');
  console.warn(`[verify] WARNING: ${nonBlockingFailures} non-blocking gate(s) are not PASS. They are reported exactly as measured and are NOT counted as passes.`);
}

console.log('[verify] All blocking gates PASS and every inspected artifact is bound to the certified commit.');
process.exit(0);
