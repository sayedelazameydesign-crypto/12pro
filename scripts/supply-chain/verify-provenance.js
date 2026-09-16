#!/usr/bin/env node
/**
 * Verify build provenance.
 *
 * The previous version printed:
 *     '[provenance] Provenance verified - artifact linked to repo+commit+workflow (simulated) - PASS'
 * It verified nothing and always exited 0.
 *
 * This version checks what can actually be checked from inside a build:
 *   1. an attestation record exists that is bound to the commit under certification
 *   2. that record names a builder and a repository
 *   3. the record states what was NOT verified (no attestation may be silent about it)
 *   4. if a GitHub release is claimed, `gh` is available and the release exists
 *
 * When there is no release yet, that is reported as NOT_VERIFIED rather than PASS:
 * absence of evidence is not evidence.
 *
 * Exit codes: 0 = verified (or NOT_VERIFIED without --strict), 1 = failed, 2 = usage error.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Which part of the chain to check.
 *
 *   release     - only release-level provenance. Used by supply-chain.yml, which runs
 *                 in PARALLEL with certification.yml; the attestation record does not
 *                 exist yet at that point, so demanding it there would make this job
 *                 depend on another workflow's output.
 *   attestation - only the attestation record bound to the commit.
 *   both        - default; used where the record is expected to exist.
 */
const SCOPE = process.argv.find((a) => a.startsWith('--scope='))?.split('=')[1] ?? 'both';
if (!['release', 'attestation', 'both'].includes(SCOPE)) {
  console.error(`[provenance] --scope must be release|attestation|both, got "${SCOPE}"`);
  process.exit(2);
}
const CHECK_RECORD = SCOPE === 'attestation' || SCOPE === 'both';
const CHECK_RELEASE = SCOPE === 'release' || SCOPE === 'both';

const strict = process.argv.includes('--strict');
const inCi = process.env.CI === 'true';
console.log(`[provenance] scope                     : ${SCOPE}`);

const IS_SHA = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);

function resolveCommit() {
  const arg = process.argv.find((a) => a.startsWith('--commit'))?.split('=')[1];
  if (arg) return { commit: arg.trim(), source: 'argument' };
  if (process.env.GITHUB_SHA) return { commit: process.env.GITHUB_SHA.trim(), source: 'GITHUB_SHA' };
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' });
  if (result.status === 0 && result.stdout) return { commit: result.stdout.trim(), source: 'git-rev-parse' };
  return { commit: null, source: 'unbound' };
}

const { commit: COMMIT, source: COMMIT_SOURCE } = resolveCommit();
console.log(`[provenance] commit under certification: ${COMMIT ?? '(unbound)'} [${COMMIT_SOURCE}]`);

const ATTEST_DIR = 'certification/attestations';
const failures = [];
const warnings = [];

// ---- 1/2/3. attestation record for this commit -----------------------------
let record = null;
let recordFile = null;

if (!CHECK_RECORD) {
  console.log('[provenance] attestation record        : not in scope for this run');
} else if (!existsSync(ATTEST_DIR)) {
  failures.push(`no attestation directory at ${ATTEST_DIR}`);
} else {
  const files = readdirSync(ATTEST_DIR).filter((f) => f.endsWith('.json')).sort();
  console.log(`[provenance] attestation records present: ${files.length}`);

  if (IS_SHA(COMMIT) && existsSync(join(ATTEST_DIR, `${COMMIT}.json`))) {
    recordFile = join(ATTEST_DIR, `${COMMIT}.json`);
  } else {
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(ATTEST_DIR, file), 'utf-8'));
        if (data.commit === COMMIT) {
          recordFile = join(ATTEST_DIR, file);
          break;
        }
      } catch {
        // reported below
      }
    }
  }

  if (recordFile) {
    try {
      record = JSON.parse(readFileSync(recordFile, 'utf-8'));
    } catch (err) {
      failures.push(`${recordFile} is unparsable: ${err.message}`);
    }
  } else if (inCi || IS_SHA(COMMIT)) {
    failures.push(
      `no attestation record is bound to ${COMMIT ?? 'the certified commit'}; ` +
        `${files.length} record(s) exist but name other commits and cannot be attributed to this one`,
    );
  } else {
    warnings.push('no commit resolved, so no attestation can be matched to one');
  }
}

if (record) {
  console.log(`[provenance] matched record: ${recordFile}`);

  const builder = record.builder ?? record.attestations?.buildProvenance?.builder ?? null;
  const repository = record.repository ?? null;
  const attestationType = record.attestationType ?? record.attestations?.buildProvenance?.type ?? null;

  if (!builder) failures.push('record names no builder');
  else console.log(`[provenance] builder     : ${builder}`);

  if (!repository) failures.push('record names no repository');
  else console.log(`[provenance] repository  : ${repository}`);

  if (!attestationType) warnings.push('record declares no attestation type');
  else console.log(`[provenance] type        : ${attestationType}`);

  if (!record.verificationStatement) {
    failures.push('record carries no verificationStatement - an attestation must state what it did NOT verify');
  } else {
    const statement = record.verificationStatement;
    console.log(`[provenance] not verified: liveProviders=${statement.liveProviderStatus ?? 'unspecified'}, e2e=${statement.e2eStatus ?? 'unspecified'}`);
    if (statement.liveProvidersContacted === true && statement.liveProviderStatus === 'UNKNOWN') {
      failures.push('record claims providers were contacted but reports their status as UNKNOWN - contradictory');
    }
  }

  if (record.commit !== COMMIT) {
    failures.push(`record commit ${String(record.commit)} != certified commit ${COMMIT}`);
  }
}

// ---- 4. release provenance (optional, honest when absent) -------------------
let releaseVerified = false;
const ghAvailable = spawnSync('gh', ['--version'], { encoding: 'utf-8' }).status === 0;
if (!CHECK_RELEASE) {
  console.log('[provenance] release provenance        : not in scope for this run');
} else if (!ghAvailable) {
  warnings.push('`gh` is not available, so release provenance could not be checked');
} else {
  const result = spawnSync('gh', ['release', 'list', '--limit', '5'], { encoding: 'utf-8' });
  const output = (result.stdout ?? '').trim();
  if (result.status !== 0 || output.length === 0) {
    warnings.push('no GitHub release exists yet, so release-level provenance is NOT_VERIFIED (not PASS)');
  } else {
    releaseVerified = true;
    console.log(`[provenance] releases found:\n${output.split('\n').slice(0, 5).map((l) => `  ${l}`).join('\n')}`);
  }
}

for (const warning of warnings) console.warn(`[provenance] WARN ${warning}`);
for (const failure of failures) console.error(`[provenance] FAIL ${failure}`);

console.log('');
console.log(`[provenance] attestation bound to commit : ${CHECK_RECORD ? (record ? 'yes' : 'no') : 'not in scope'}`);
console.log(`[provenance] release provenance          : ${CHECK_RELEASE ? (releaseVerified ? 'verified' : 'NOT_VERIFIED') : 'not in scope'}`);
console.log(`[provenance] failures                    : ${failures.length}`);
console.log(`[provenance] warnings                    : ${warnings.length}`);

if (failures.length > 0) {
  console.error(`[provenance] FAILED - ${failures.length} check(s) did not pass.`);
  process.exit(1);
}

if (strict && warnings.length > 0) {
  console.error(`[provenance] FAILED (--strict) - ${warnings.length} warning(s) promoted to failures.`);
  process.exit(1);
}

if (CHECK_RELEASE && !releaseVerified) {
  console.log('[provenance] NOT_VERIFIED for release-level provenance. This is not a pass; it is an absence of evidence.');
} else if (failures.length === 0) {
  console.log('[provenance] verified against real records. Nothing in this output is simulated.');
}
process.exit(0);
