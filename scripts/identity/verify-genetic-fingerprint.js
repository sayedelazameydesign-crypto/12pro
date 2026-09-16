#!/usr/bin/env node
/**
 * Verify the genetic fingerprint and run the G16 Genetic Identity Gate.
 *
 * Plain JavaScript so it runs on any supported Node without a build step, and so
 * that a CI step can never be accused of executing untypechecked logic: the
 * algorithm it verifies lives in TypeScript in @agi-system/identity and is
 * typechecked by `npm run typecheck`.
 *
 * Usage:
 *   node scripts/identity/verify-genetic-fingerprint.js --commit=$GITHUB_SHA --require-commit-binding
 *   node scripts/identity/verify-genetic-fingerprint.js --root=. --write-gate
 *
 * Exit codes:
 *   0  every check passed
 *   1  at least one check failed
 *   2  usage / environment error
 *
 * This script NEVER prints a simulated pass. If it cannot verify something, that
 * something is reported as FAIL with a reason.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runG16Checks, REQUIRED_PATHS } from '../../packages/identity/src/g16-checks.ts';

const here = dirname(fileURLToPath(import.meta.url));

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}

function resolveCommit() {
  const fromArg = argValue('--commit');
  if (fromArg !== null) {
    return { commit: fromArg.trim() || null, source: 'argument' };
  }
  if (process.env.GITHUB_SHA) {
    return { commit: process.env.GITHUB_SHA.trim(), source: 'GITHUB_SHA' };
  }
  const root = resolve(argValue('--root') ?? join(here, '..', '..'));
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
    return { commit: sha, source: 'git-rev-parse' };
  } catch {
    return { commit: null, source: 'unbound' };
  }
}

/** Collect certification artifacts that carry a `commit` field, for evidence binding. */
/** Per-commit attestation records are named `<40-hex>.json`. */
const PER_COMMIT_RECORD = /^[0-9a-f]{40}\.json$/;

/**
 * Collect the artifacts whose commit binding must equal the certified commit.
 *
 * SCOPING RULE: a per-commit attestation record naming a DIFFERENT commit is evidence
 * for a DIFFERENT certification. Including it here made `evidence-bound` fail on
 * history rather than on the current run - every previous commit's record that happened
 * to still be in the working tree counted as a mismatch, so the gate could never pass
 * once more than one certification had ever been produced.
 *
 * Such records are excluded from the check but COUNTED and reported, so the scoping is
 * visible instead of silent. `latest.json` stays in scope: it claims to describe the
 * current certification, so it must be bound to the current commit.
 */
function collectEvidencePaths(root, certifiedCommit) {
  const out = [];
  const historical = [];
  const roots = ['certification/manifests', 'certification/reports', 'certification/attestations', 'certification/gates'];

  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.json')) continue;
      // G16 is written by this very run, so it cannot be its own evidence input.
      if (entry.name === 'G16.json') continue;

      const rel = full.slice(root.length + 1).split('\\').join('/');

      if (PER_COMMIT_RECORD.test(entry.name) && certifiedCommit && entry.name !== `${certifiedCommit}.json`) {
        historical.push(rel);
        continue;
      }

      try {
        const parsed = JSON.parse(readFileSync(full, 'utf-8'));
        if (parsed && typeof parsed === 'object' && 'commit' in parsed) {
          out.push(rel);
        }
      } catch {
        // Unparsable artifacts are reported by the binding check itself.
        out.push(rel);
      }
    }
  };

  for (const r of roots) walk(join(root, r));
  return { paths: out.sort(), historical: historical.sort() };
}

function main() {
  const root = resolve(argValue('--root') ?? join(here, '..', '..'));
  const requireCommitBinding = hasFlag('--require-commit-binding') || process.env.CI === 'true';
  const writeGate = hasFlag('--write-gate');
  const json = hasFlag('--json');

  const { commit, source } = resolveCommit();

  if (!existsSync(join(root, 'package.json'))) {
    console.error(`[verify-genetic] not a repository root: ${root}`);
    return 2;
  }

  const missingRequired = REQUIRED_PATHS.filter((p) => !existsSync(join(root, p)));
  if (missingRequired.length > 0) {
    console.error(`[verify-genetic] ${missingRequired.length} required path(s) missing:`);
    for (const p of missingRequired) console.error(`[verify-genetic]   - ${p}`);
    console.error('[verify-genetic] run scripts/identity/generate-genetic-fingerprint.ts first');
    // Continue anyway: the gate report should show exactly which checks failed.
  }

  const evidence = collectEvidencePaths(root, commit);
  const evidencePaths = evidence.paths;
  if (evidence.historical.length > 0) {
    console.log(
      `[verify-genetic] ${evidence.historical.length} attestation record(s) for OTHER commits excluded from ` +
        `evidence binding (they certify a different commit): ${evidence.historical.slice(0, 3).join(', ')}` +
        `${evidence.historical.length > 3 ? ', ...' : ''}`,
    );
  }

  const report = runG16Checks({
    root,
    expectedCommit: commit,
    requireCommitBinding,
    evidencePaths,
  });

  const gateArtifact = {
    gate: report.gate,
    name: report.name,
    description: report.description,
    status: report.status,
    /**
     * Commit binding is METADATA about the measurement. It is deliberately not an
     * input to the fingerprint - see the `circular-free` check.
     */
    commit,
    commitSource: source,
    timestamp: new Date().toISOString(),
    /** Counted from real results. Never a literal. */
    tests: report.total,
    passed: report.passed,
    failed: report.failed,
    checks: report.checks,
    identity: {
      fingerprint: report.fingerprint,
      identityId: report.identityId,
      manifestHash: report.manifestHash,
      merkleRoot: report.merkleRoot,
      leafCount: report.leafCount,
    },
    evidence: {
      secretRuleCount: report.secretRuleCount,
      evidenceArtifactsChecked: evidencePaths.length,
      /** Records for other commits, excluded from binding and reported rather than dropped silently. */
      historicalAttestationsExcluded: evidence.historical.length,
      requiredPaths: REQUIRED_PATHS.length,
      requireCommitBinding,
    },
    required: true,
    blocking: true,
  };

  if (writeGate) {
    const gatePath = join(root, 'certification', 'gates', 'G16.json');
    mkdirSync(dirname(gatePath), { recursive: true });
    writeFileSync(gatePath, `${JSON.stringify(gateArtifact, null, 2)}\n`, 'utf-8');
  }

  if (json) {
    console.log(JSON.stringify(gateArtifact, null, 2));
  } else {
    console.log(`[G16] Genetic Identity Gate - commit ${commit ?? '(unbound)'} [source: ${source}]`);
    console.log(`[G16] fingerprint ${report.fingerprint}`);
    console.log(`[G16] identityId  ${report.identityId}`);
    console.log(`[G16] merkleRoot  ${report.merkleRoot}`);
    console.log(`[G16] leafCount   ${report.leafCount}`);
    console.log(`[G16] ---`);
    for (const check of report.checks) {
      console.log(`[G16] ${check.status === 'PASS' ? 'PASS' : 'FAIL'}  ${check.id}`);
      console.log(`[G16]       ${check.detail}`);
    }
    console.log(`[G16] ---`);
    // The count is printed from the counted values, so it can never disagree
    // with the artifact (no "12/18" style inconsistency).
    console.log(`[G16] ${report.passed}/${report.total} checks passed, ${report.failed} failed -> ${report.status}`);
  }

  if (report.status !== 'PASS') {
    console.error(`[G16] FAILED: ${report.failed} of ${report.total} checks did not pass`);
    return 1;
  }
  return 0;
}

process.exit(main());
