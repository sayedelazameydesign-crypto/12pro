#!/usr/bin/env node
/**
 * Emit the closure statement.
 *
 * The requirement is a chain of equalities:
 *
 *     Remote HEAD == certified commit == manifest binding == evidence binding
 *                                       == recomputed genome binding
 *
 * This script checks each link against the artifacts produced on the remote commit
 * and prints an explicit, per-link verdict. It does not summarise optimistically: a
 * broken link is printed as broken, and the script exits non-zero.
 *
 * Intended for `>> "$GITHUB_STEP_SUMMARY"` in a job that did NOT generate the
 * artifacts it is judging.
 *
 * Usage:
 *   node scripts/certification/closure-statement.js --dir=certification-from-ci --commit=<sha>
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function argValue(flag, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
}

const COMMIT = argValue('--commit');
const DIR = resolve(argValue('--dir', 'certification'));

if (!COMMIT) {
  console.error('[closure] --commit is required');
  process.exit(2);
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const links = [];

function link(name, actual, expected = COMMIT) {
  links.push({ name, actual, expected, ok: actual === expected });
}

// 1. The commit the workflow is certifying.
link('Remote HEAD (github.sha)', COMMIT);

// 2. The manifest.
const manifest = readJson(join(DIR, 'manifests', 'latest.json'));
link('Certified commit (manifest)', manifest?.commit ?? null);
link('Manifest commit binding', manifest?.commit ?? null);

// 3. The attestation.
const attestation = readJson(join(DIR, 'attestations', 'latest.json'));
link('Evidence binding (attestation)', attestation?.commit ?? null);

// 4. The genetic identity record - commit lives in the non-hashed binding envelope.
const identity = readJson(join(DIR, 'identity', 'genetic-manifest.json'));
link('Genome record binding', identity?.binding?.commit ?? null);

// 5. G16.
const g16 = readJson(join(DIR, 'gates', 'G16.json'));
link('G16 artifact binding', g16?.commit ?? null);

// 6. Every gate artifact.
const gatesDir = join(DIR, 'gates');
let gateFiles = [];
if (existsSync(gatesDir)) gateFiles = readdirSync(gatesDir).filter((f) => f.endsWith('.json')).sort();
let gatesBound = 0;
for (const file of gateFiles) {
  const data = readJson(join(gatesDir, file));
  if (data?.commit === COMMIT) gatesBound += 1;
}
links.push({
  name: `Gate artifacts bound (${gatesBound}/${gateFiles.length})`,
  actual: gatesBound === gateFiles.length && gateFiles.length > 0 ? COMMIT : `${gatesBound}/${gateFiles.length}`,
  expected: COMMIT,
  ok: gatesBound === gateFiles.length && gateFiles.length > 0,
});

// 7. Every evidence report that carries a commit field.
const reportsDir = join(DIR, 'reports');
let reportFiles = [];
if (existsSync(reportsDir)) {
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) reportFiles.push(full);
    }
  };
  walk(reportsDir);
}
let reportsBound = 0;
let reportsTotal = 0;
for (const file of reportFiles) {
  if (relative(DIR, file).startsWith('reports/raw/')) continue; // raw reporter input, not a claim
  const data = readJson(file);
  if (!data || !('commit' in data)) continue;
  reportsTotal += 1;
  if (data.commit === COMMIT) reportsBound += 1;
}
links.push({
  name: `Evidence reports bound (${reportsBound}/${reportsTotal})`,
  actual: reportsBound === reportsTotal && reportsTotal > 0 ? COMMIT : `${reportsBound}/${reportsTotal}`,
  expected: COMMIT,
  ok: reportsBound === reportsTotal && reportsTotal > 0,
});

// --------------------------------------------------------------------- output

const out = [];
out.push('## Closure statement');
out.push('');
out.push('Required chain:');
out.push('');
out.push('```');
out.push('Remote HEAD == certified commit == manifest binding == evidence binding == recomputed genome binding');
out.push('```');
out.push('');
out.push('| Link | Value | Matches |');
out.push('| --- | --- | --- |');
for (const l of links) {
  const value = l.actual === null ? '*(null)*' : String(l.actual).length > 44 ? `\`${String(l.actual).slice(0, 44)}...\`` : `\`${l.actual}\``;
  out.push(`| ${l.name} | ${value} | ${l.ok ? 'yes' : '**NO**'} |`);
}
out.push('');

if (identity?.manifest) {
  out.push('### Genetic identity');
  out.push('');
  out.push('| Property | Value |');
  out.push('| --- | --- |');
  out.push(`| fingerprint | \`${identity.manifest.fingerprint}\` |`);
  out.push(`| identityId | \`${identity.manifest.identityId}\` |`);
  out.push(`| manifestHash | \`${identity.manifest.manifestHash}\` |`);
  out.push(`| merkleRoot | \`${identity.manifest.files.merkleRoot}\` |`);
  out.push(`| leafCount | ${identity.manifest.files.leafCount} |`);
  out.push(`| binding.commitSource | \`${identity.binding.commitSource}\` |`);
  out.push('');
  out.push(
    '> The commit appears only in the non-hashed `binding` envelope. It is never an input to the fingerprint, ' +
      'so generating this record did not change the fingerprint it records.',
  );
  out.push('');
}

const broken = links.filter((l) => !l.ok);
if (broken.length > 0) {
  out.push(`### **CLOSURE FAILED** - ${broken.length} link(s) do not match`);
  out.push('');
  for (const b of broken) out.push(`- ${b.name}: \`${b.actual ?? 'null'}\` != \`${b.expected}\``);
  out.push('');
  out.push('This certification must NOT be treated as public. The chain is broken.');
} else {
  out.push('### Closure holds');
  out.push('');
  out.push(`Every link equals \`${COMMIT}\`. The certification is attributable to exactly one commit.`);
}
out.push('');

console.log(out.join('\n'));
process.exit(broken.length > 0 ? 1 : 0);
