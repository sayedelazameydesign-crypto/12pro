#!/usr/bin/env node
/**
 * Assert that the fingerprint produced by the certify job is identical to the one
 * produced independently on a different runner.
 *
 * Reproducibility across machines is the real test of determinism. Recomputing twice
 * in one process only proves the function is pure; recomputing on a separate runner
 * proves the genome does not depend on anything local to the machine that built it.
 *
 * Usage:
 *   node scripts/certification/assert-fingerprint-match.js \
 *     --record=certification-from-ci/identity/genetic-manifest.json \
 *     --expected-file=fingerprint-reproducibility/fingerprint.txt
 *
 * Exit codes: 0 = match, 1 = mismatch or unreadable, 2 = usage error.
 */
import { existsSync, readFileSync } from 'node:fs';

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

const RECORD = argValue('--record');
const EXPECTED_FILE = argValue('--expected-file');

if (!RECORD || !EXPECTED_FILE) {
  console.error('[fingerprint-match] usage: --record=<genetic-manifest.json> --expected-file=<fingerprint.txt>');
  process.exit(2);
}

if (!existsSync(RECORD)) {
  console.error(`[fingerprint-match] record not found: ${RECORD}`);
  process.exit(1);
}
if (!existsSync(EXPECTED_FILE)) {
  console.error(`[fingerprint-match] expected-fingerprint file not found: ${EXPECTED_FILE}`);
  process.exit(1);
}

let record;
try {
  record = JSON.parse(readFileSync(RECORD, 'utf-8'));
} catch (err) {
  console.error(`[fingerprint-match] record is unparsable: ${err.message}`);
  process.exit(1);
}

const recordFingerprint = record?.manifest?.fingerprint ?? null;
const recordIdentityId = record?.manifest?.identityId ?? null;
const recordMerkleRoot = record?.manifest?.files?.merkleRoot ?? null;
const recordLeafCount = record?.manifest?.files?.leafCount ?? null;

const expected = readFileSync(EXPECTED_FILE, 'utf-8').trim();

console.log('[fingerprint-match] certified record fingerprint :', recordFingerprint);
console.log('[fingerprint-match] independent runner fingerprint:', expected);
console.log('[fingerprint-match] identityId                   :', recordIdentityId);
console.log('[fingerprint-match] merkleRoot                   :', recordMerkleRoot);
console.log('[fingerprint-match] leafCount                    :', recordLeafCount);

const failures = [];

if (!recordFingerprint) failures.push('the certified record carries no fingerprint');
if (!/^[0-9a-f]{64}$/.test(expected)) failures.push(`the independent fingerprint is not 64-hex: "${expected}"`);
if (recordFingerprint && expected && recordFingerprint !== expected) {
  failures.push(
    `fingerprint differs between runners: certified ${recordFingerprint.slice(0, 16)}... vs independent ${expected.slice(0, 16)}... ` +
      '- the genome is not reproducible across machines',
  );
}

// The record must also be internally consistent: identityId is derived from the
// fingerprint, so a mismatch means one of them was edited by hand.
if (recordFingerprint && recordIdentityId && recordIdentityId !== `agi-${recordFingerprint.slice(0, 16)}`) {
  failures.push(`identityId ${recordIdentityId} is not derived from fingerprint ${recordFingerprint.slice(0, 16)}...`);
}

if (failures.length > 0) {
  console.error('');
  for (const failure of failures) console.error(`[fingerprint-match] FAIL ${failure}`);
  process.exit(1);
}

console.log('');
console.log('[fingerprint-match] PASS - fingerprint is identical on both runners and internally consistent');
process.exit(0);
