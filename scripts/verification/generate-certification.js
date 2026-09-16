#!/usr/bin/env node
/**
 * Generate the certification manifest.
 *
 * DEPRECATED ENTRYPOINT - kept so existing `npm run certify` and release.yml keep
 * working, but it now delegates to the real orchestrator instead of assembling a
 * manifest from whatever stale gate files happen to be on disk.
 *
 * Why it changed: the previous version read `certification/gates/*.json`,
 * `certification/reports/*.json` and `certification/benchmarks/*.json` and copied
 * them into a manifest verbatim, stamping in a `--commit` argument that was never
 * compared with the commit fields inside those files. The result was a manifest
 * that claimed to describe one commit while embedding artifacts bound to another.
 *
 * The orchestrator runs the real suites and binds everything to a single commit,
 * then asserts the binding at the end.
 *
 * Usage:
 *   node scripts/verification/generate-certification.js --commit=$GITHUB_SHA --version=0.1.0
 */
import { spawnSync } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORCHESTRATOR = path.resolve(HERE, '..', 'certification', 'run-certification.js');

const commitArg = process.argv.find((a) => a.startsWith('--commit'))?.split('=')[1] ?? process.env.GITHUB_SHA ?? null;
const versionArg = process.argv.find((a) => a.startsWith('--version'))?.split('=')[1] ?? '0.1.0';

const forwarded = [];
if (commitArg) forwarded.push(`--commit=${commitArg}`);
if (process.env.CI === 'true' || process.argv.includes('--require-commit-binding')) forwarded.push('--require-binding');
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--skip=')) forwarded.push(arg);
  if (arg === '--quick') forwarded.push(arg);
}

console.log(`[certify] delegating to the certification orchestrator (version ${versionArg})`);
console.log(`[certify]   ${ORCHESTRATOR} ${forwarded.join(' ')}`);

const result = spawnSync('node', [ORCHESTRATOR, ...forwarded], { stdio: 'inherit', cwd: path.resolve(HERE, '..', '..') });
process.exit(result.status ?? 1);
