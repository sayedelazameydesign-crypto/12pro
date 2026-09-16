#!/usr/bin/env node
/**
 * Secret scanning over the tracked tree.
 *
 * Uses the same rule set and the same reviewed allow-list as the G16
 * `no-secret-material` check, so CI and the genetic identity gate can never disagree
 * about what counts as a secret.
 *
 * Findings that are not on the reviewed allow-list fail the job. Raw secret values
 * are never printed or written - only the redacted form.
 *
 * Usage:
 *   node scripts/security/secret-scan.js [--out=certification/reports/secret-scan.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  scanRepository,
  scanRepositoryForSecrets,
  partitionFindings,
  findStaleAllowlistEntries,
  secretRuleInventory,
} from '../../packages/identity/src/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const outArg = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
const OUT = resolve(outArg ?? 'certification/reports/secret-scan.json');

/**
 * Explicit --commit wins, so the orchestrator can bind this report to the same single
 * commit it bound everything else to. Without it this script resolved HEAD on its own,
 * which is the exact ambiguity the binding requirement exists to remove.
 */
function resolveCommit() {
  const arg = process.argv.find((a) => a.startsWith('--commit='))?.split('=')[1];
  if (arg) return { commit: arg.trim(), source: 'argument' };
  if (process.env.GITHUB_SHA) return { commit: process.env.GITHUB_SHA.trim(), source: 'GITHUB_SHA' };
  try {
    return { commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf-8' }).trim(), source: 'git-rev-parse' };
  } catch {
    return { commit: null, source: 'unbound' };
  }
}

const { commit, source } = resolveCommit();
const scan = scanRepository({ root: ROOT });
const found = scanRepositoryForSecrets(scan.leaves, ROOT);
const { explained, unexplained } = partitionFindings(found.findings);
const stale = findStaleAllowlistEntries(found.findings);

const report = {
  report: 'secret-scan',
  status: unexplained.length === 0 && stale.length === 0 ? 'PASS' : 'FAIL',
  commit,
  commitSource: source,
  timestamp: new Date().toISOString(),
  generator: 'scripts/security/secret-scan.js',
  summary: {
    filesScanned: found.scannedFiles,
    rules: secretRuleInventory().length,
    findings: found.findings.length,
    explainedByAllowlist: explained.length,
    unexplained: unexplained.length,
    staleAllowlistEntries: stale.length,
    secretContainersBlocked: found.blockedPaths.length,
  },
  rules: secretRuleInventory(),
  // Redacted only. Never the raw value.
  explained: explained.map((e) => ({
    path: e.finding.path,
    line: e.finding.line,
    ruleId: e.finding.ruleId,
    redactedExcerpt: e.finding.redactedExcerpt,
    reason: e.reason,
  })),
  unexplained: unexplained.map((f) => ({
    path: f.path,
    line: f.line,
    ruleId: f.ruleId,
    redactedExcerpt: f.redactedExcerpt,
  })),
  staleAllowlist: stale.map((e) => ({ path: e.path, ruleId: e.ruleId })),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');

console.log(`[secret-scan] commit      : ${commit ?? '(unbound)'} [${source}]`);
console.log(`[secret-scan] files       : ${report.summary.filesScanned} scanned against ${report.summary.rules} rules`);
console.log(`[secret-scan] findings    : ${report.summary.findings} (${report.summary.explainedByAllowlist} explained by the reviewed allow-list, ${report.summary.unexplained} unexplained)`);
console.log(`[secret-scan] .env leaves : ${scan.leaves.filter((l) => /(^|\/)\.env(\.|$)/.test(l.path)).length} (must be 0)`);
console.log(`[secret-scan] status      : ${report.status}`);
console.log(`[secret-scan] wrote       : ${OUT}`);

if (unexplained.length > 0) {
  console.error('');
  console.error(`[secret-scan] FAIL: ${unexplained.length} unexplained secret finding(s):`);
  for (const finding of unexplained) {
    console.error(`[secret-scan]   ${finding.path}:${finding.line} [${finding.ruleId}] ${finding.redactedExcerpt}`);
  }
  process.exit(1);
}

if (stale.length > 0) {
  console.error('');
  console.error(`[secret-scan] FAIL: ${stale.length} allow-list entr(ies) no longer match anything and must be removed:`);
  for (const entry of stale) console.error(`[secret-scan]   ${entry.path} [${entry.ruleId}]`);
  process.exit(1);
}

process.exit(0);
