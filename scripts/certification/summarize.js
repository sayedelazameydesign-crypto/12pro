#!/usr/bin/env node
/**
 * Write the certification summary (markdown) to stdout.
 *
 * Intended for `>> "$GITHUB_STEP_SUMMARY"`. It reads only artifacts that the
 * certification run actually produced, so the summary cannot claim anything the run
 * did not measure. Where a gate is PARTIAL or NOT_CERTIFIED, the summary says so and
 * gives the recorded reason.
 *
 * Usage:
 *   node scripts/certification/summarize.js --commit=<sha> [--dir=certification]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function argValue(flag, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
}

const COMMIT = argValue('--commit');
const DIR = resolve(argValue('--dir', 'certification'));

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const manifest = readJson(join(DIR, 'manifests', 'latest.json'));
const identity = readJson(join(DIR, 'identity', 'genetic-manifest.json'));
const g16 = readJson(join(DIR, 'gates', 'G16.json'));
const e2e = readJson(join(DIR, 'reports', 'e2e.json'));

const lines = [];
lines.push('## Certification summary');
lines.push('');

if (!manifest) {
  lines.push('> **No certification manifest was produced.** Nothing below can be claimed.');
  lines.push('');
  console.log(lines.join('\n'));
  process.exit(1);
}

lines.push('| Property | Value |');
lines.push('| --- | --- |');
lines.push(`| Commit under certification | \`${manifest.commit ?? '(unbound)'}\` |`);
lines.push(`| Commit source | \`${manifest.commitSource ?? 'unknown'}\` |`);
lines.push(`| Ran in CI | ${manifest.ci === true ? 'yes' : 'no'} |`);
lines.push(`| Generator | \`${manifest.generator ?? 'unknown'}\` |`);
if (manifest.identity?.fingerprint) {
  lines.push(`| Genetic fingerprint | \`${manifest.identity.fingerprint}\` |`);
  lines.push(`| Identity id | \`${manifest.identity.identityId}\` |`);
  lines.push(`| Merkle root | \`${manifest.identity.merkleRoot}\` |`);
  lines.push(`| Genome leaves | ${manifest.identity.leafCount} |`);
  lines.push(
    `| Identity binding matches manifest | ${manifest.identity.bindingMatchesManifest ? 'yes' : '**NO**'} |`,
  );
}
lines.push('');

const counts = manifest.counts ?? {};
lines.push(
  `**Gates:** ${counts.gates ?? 0} total - ${counts.pass ?? 0} PASS, ${counts.partial ?? 0} PARTIAL, ` +
    `${counts.fail ?? 0} FAIL, ${counts.notCertified ?? 0} NOT_CERTIFIED`,
);
lines.push('');

lines.push('| Gate | Status | Evidence | Blocking | Reason |');
lines.push('| --- | --- | --- | --- | --- |');
for (const [name, gate] of Object.entries(manifest.gates ?? {})) {
  const artifact = readJson(join(DIR, 'gates', `${name}.json`));
  const num = (v) => (typeof v === 'number' ? String(v) : 'n/a');
  let evidence = '-';
  if (Array.isArray(artifact?.checks)) {
    // G16 reports its check list; the totals live in `tests`/`passed`.
    evidence = `${num(artifact.passed)}/${num(artifact.tests)} checks`;
  } else if (typeof artifact?.tests === 'number') {
    evidence = `${num(artifact.passed)}/${num(artifact.tests)}`;
    if (artifact.failed) evidence += ` (${artifact.failed} failed)`;
  }
  const reason = String(
    artifact?.reason ??
      (Array.isArray(artifact?.checks)
        ? `${artifact.passed}/${artifact.tests} genetic identity checks passed`
        : ''),
  )
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .slice(0, 150);
  const statusMark =
    gate.status === 'PASS' ? 'PASS' : gate.status === 'PARTIAL' ? 'PARTIAL' : gate.status === 'FAIL' ? '**FAIL**' : 'NOT_CERTIFIED';
  lines.push(`| ${name} | ${statusMark} | ${evidence} | ${gate.blocking ? 'yes' : 'no'} | ${reason || '-'} |`);
}
lines.push('');

if (Array.isArray(g16?.checks)) {
  lines.push(`### G16 Genetic Identity Gate - ${g16.passed}/${g16.tests} checks`);
  lines.push('');
  lines.push('| Check | Status |');
  lines.push('| --- | --- |');
  for (const check of g16.checks) {
    lines.push(`| \`${check.id}\` | ${check.status === 'PASS' ? 'PASS' : '**FAIL**'} |`);
  }
  lines.push('');
  lines.push(
    `Counted from real results: **${g16.passed}/${g16.tests}** passed, ${g16.failed} failed. ` +
      `The check count is ${g16.tests} and is read from the artifact, never written by hand.`,
  );
  if (g16.identity?.fingerprint) {
    lines.push('');
    lines.push(`Fingerprint \`${g16.identity.fingerprint}\` - identityId \`${g16.identity.identityId}\`.`);
  }
  lines.push('');
}

lines.push('### What this run does NOT certify');
lines.push('');
const notCertified = [];
if (e2e && e2e.status !== 'PASS') {
  notCertified.push(`**End-to-end behaviour** - E2E status is \`${e2e.status}\`: ${String(e2e.reason ?? '').slice(0, 200)}`);
}
const notMeasured = (manifest.gates && manifest.gates.G8 && readJson(join(DIR, 'gates', 'G8.json'))?.benchmarks) || [];
const unmeasuredBenchmarks = notMeasured.filter((b) => b.status === 'NOT_MEASURED').map((b) => b.benchmark);
if (unmeasuredBenchmarks.length > 0) {
  notCertified.push(
    `**Benchmarks: ${unmeasuredBenchmarks.join(', ')}** - NOT_MEASURED. No number is reported for them because none was measured.`,
  );
}
notCertified.push(
  '**Live provider availability** - no provider was contacted. Ollama, NVIDIA, Gemini, Groq and Hugging Face all report live status `UNKNOWN`. The provider layer is MOCK-ONLY for this run.',
);
notCertified.push(
  '**Autonomy in production** - the supervised autonomy loop is unit-tested, not deployed. No promotion decision here reflects a live system.',
);

for (const item of notCertified) lines.push(`- ${item}`);
lines.push('');

console.log(lines.join('\n'));
process.exit(0);
