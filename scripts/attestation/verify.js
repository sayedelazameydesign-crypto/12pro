#!/usr/bin/env node
/**
 * Verify artifact attestations.
 *
 * The previous version ended with:
 *     '[attestation:verify] Attestation verification complete - PASS (simulated)'
 * and always exited 0, whatever it found. A simulated pass is worse than no check,
 * because downstream gates read it as evidence. This version performs real checks
 * and exits non-zero when they fail.
 *
 * Checks performed:
 *   1. the SBOM artifact exists and is parsable SPDX
 *   2. an attestation record exists for the commit being certified
 *   3. every attestation record that claims a commit is bound to THIS commit
 *      (records bound to other commits are reported as unattributable)
 *   4. attestation records name a builder and a repository
 *   5. the attestation states plainly what was NOT verified
 *
 * Exit codes: 0 = verified, 1 = failed, 2 = usage/environment error.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'node:child_process';

const commitArg = process.argv.find((a) => a.startsWith('--commit'))?.split('=')[1] ?? null;
const strict = process.argv.includes('--strict');
const inCi = process.env.CI === 'true';
const requireBinding = process.argv.includes('--require-commit-binding') || inCi;

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
  console.error(`[attestation:verify] FATAL: binding required but commit is not a 40-hex SHA (got ${String(COMMIT)} from ${COMMIT_SOURCE}).`);
  process.exit(2);
}

console.log(`[attestation:verify] commit under certification: ${COMMIT ?? '(unbound)'} [source: ${COMMIT_SOURCE}]`);

const failures = [];
const warnings = [];

// ---- 1. SBOM -----------------------------------------------------------------
const sbomPath = 'certification/sbom/sbom.spdx.json';
let sbomPackages = 0;
if (!fs.existsSync(sbomPath)) {
  failures.push(`SBOM missing at ${sbomPath}`);
} else {
  try {
    const sbom = JSON.parse(fs.readFileSync(sbomPath, 'utf-8'));
    const isSpdx = typeof sbom.spdxVersion === 'string' || sbom.SPDXID || sbom.documentNamespace;
    if (!isSpdx) {
      failures.push(`${sbomPath} does not look like an SPDX document (no spdxVersion / SPDXID / documentNamespace)`);
    } else {
      sbomPackages = Array.isArray(sbom.packages) ? sbom.packages.length : 0;
      if (sbomPackages === 0) warnings.push(`${sbomPath} declares 0 packages - an empty SBOM attests to nothing`);
    }
  } catch (err) {
    failures.push(`SBOM is unparsable: ${err.message}`);
  }
}
console.log(`[attestation:verify] SBOM present: ${fs.existsSync(sbomPath)} (packages: ${sbomPackages})`);

// ---- 2/3/4. attestation records ---------------------------------------------
const attestationDir = 'certification/attestations';
const files = fs.existsSync(attestationDir)
  ? fs.readdirSync(attestationDir).filter((f) => f.endsWith('.json')).sort()
  : [];

console.log(`[attestation:verify] attestation records found: ${files.length}`);

if (files.length === 0) {
  failures.push(`no attestation records under ${attestationDir}`);
}

let boundToThisCommit = 0;
let unattributable = 0;
let malformed = 0;

for (const file of files) {
  const full = path.join(attestationDir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf-8'));
  } catch (err) {
    malformed += 1;
    failures.push(`${file} is unparsable: ${err.message}`);
    continue;
  }

  if (data.commit === COMMIT) {
    boundToThisCommit += 1;

    // 4. provenance fields must be present on a record that claims this commit.
    const builder = data.builder ?? data.attestations?.buildProvenance?.builder ?? null;
    const repository = data.repository ?? null;
    if (!builder) warnings.push(`${file} names no builder`);
    if (!repository) warnings.push(`${file} names no repository`);

    // 5. the record must state what was NOT verified.
    if (!data.verificationStatement) {
      warnings.push(`${file} carries no verificationStatement - what was NOT verified is not recorded`);
    }
  } else {
    unattributable += 1;
  }
}

if (requireBinding) {
  if (boundToThisCommit === 0) {
    failures.push(
      `no attestation record is bound to the commit being certified (${COMMIT}). ` +
        `${unattributable} record(s) name a different commit and cannot be attributed to this one.`,
    );
  }
} else if (boundToThisCommit === 0) {
  warnings.push(`no attestation record is bound to ${COMMIT ?? 'any commit'}; ${unattributable} record(s) name other commits`);
}

if (unattributable > 0) {
  console.log(
    `[attestation:verify] records bound to a DIFFERENT commit: ${unattributable} - reported, never counted as evidence for ${COMMIT ?? 'this run'}`,
  );
}
if (malformed > 0) console.log(`[attestation:verify] malformed records: ${malformed}`);

// ---- report ------------------------------------------------------------------
for (const warning of warnings) console.warn(`[attestation:verify] WARN ${warning}`);
for (const failure of failures) console.error(`[attestation:verify] FAIL ${failure}`);

console.log('');
console.log(`[attestation:verify] bound to certified commit : ${boundToThisCommit}`);
console.log(`[attestation:verify] unattributable records    : ${unattributable}`);
console.log(`[attestation:verify] failures                  : ${failures.length}`);
console.log(`[attestation:verify] warnings                  : ${warnings.length}`);

if (failures.length > 0) {
  console.error(`[attestation:verify] FAILED - ${failures.length} check(s) did not pass.`);
  process.exit(1);
}

if (strict && warnings.length > 0) {
  console.error(`[attestation:verify] FAILED (--strict) - ${warnings.length} warning(s) promoted to failures.`);
  process.exit(1);
}

console.log('[attestation:verify] verified. No result in this script is simulated.');
process.exit(0);
