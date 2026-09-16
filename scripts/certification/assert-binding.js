#!/usr/bin/env node
/**
 * Assert that every certification artifact is bound to exactly one commit.
 *
 * This is the executable form of the closure requirement:
 *
 *     Remote HEAD == certified commit == manifest binding == evidence binding
 *
 * It is run by a job that CANNOT regenerate the artifacts - it only judges what the
 * certify job produced. That is what makes it an independent check: if the two
 * disagree, one of them is wrong and the job fails.
 *
 * Exit codes: 0 = every artifact bound, 1 = mismatch or missing, 2 = usage error.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

const DIR = argValue('--dir');
const COMMIT = argValue('--commit');

if (!DIR || !COMMIT) {
  console.error('[assert-binding] usage: assert-binding.js --dir=<certification dir> --commit=<40-hex sha>');
  process.exit(2);
}
if (!/^[0-9a-f]{40}$/.test(COMMIT)) {
  console.error(`[assert-binding] --commit must be a 40-hex SHA, got "${COMMIT}"`);
  process.exit(2);
}
if (!existsSync(DIR)) {
  console.error(`[assert-binding] directory does not exist: ${DIR}`);
  process.exit(2);
}

/** Every JSON artifact under the certification tree. */
function collectJson(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.json')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const files = collectJson(DIR);
console.log(`[assert-binding] expected commit : ${COMMIT}`);
console.log(`[assert-binding] artifacts found : ${files.length} under ${DIR}`);

const bound = [];
const mismatched = [];
const unbound = [];
const unparsable = [];
/** Records that are internally inconsistent (not a commit mismatch). */
const inconsistencies = [];
/** Artifacts that legitimately carry no commit (raw reporter output, SBOM). */
const notApplicable = [];

/**
 * Resolve where an artifact records the commit it describes.
 *
 * Three shapes exist and all three are legitimate:
 *   1. `commit`            - gates, reports, manifests, attestations
 *   2. `binding.commit`    - the genetic identity records, where the commit lives in a
 *                             non-hashed envelope so that it can never become an input
 *                             to the fingerprint it is bound to
 *   3. `entries[].commit`  - lineage, which is APPEND-ONLY history. Only the newest
 *                             entry may name the certified commit; older entries name
 *                             older commits and that is the whole point of a lineage.
 *
 * Returns null when the artifact records no commit anywhere.
 */
function resolveBoundCommit(data) {
  if (typeof data?.commit === 'string') return data.commit;
  if (data?.commit === null) return null;
  if (typeof data?.binding?.commit === 'string') return data.binding.commit;
  if (Array.isArray(data?.entries) && data.entries.length > 0) {
    const newest = data.entries[data.entries.length - 1];
    if (typeof newest?.commit === 'string') return newest.commit;
  }
  return null;
}

/** Where the commit was found, for reporting. */
function bindingLocation(data) {
  if ('commit' in (data ?? {})) return 'commit';
  if (data?.binding && 'commit' in data.binding) return 'binding.commit';
  if (Array.isArray(data?.entries) && data.entries.length > 0) return `entries[${data.entries.length - 1}].commit`;
  return '(none)';
}

for (const file of files) {
  const rel = relative(DIR, file);
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    unparsable.push({ rel, error: err.message });
    continue;
  }

  // Raw vitest reporter output and the SBOM have no commit field by design; they are
  // inputs to the gates, not certification claims.
  if (rel.startsWith('reports/raw/') || rel.startsWith('sbom/')) {
    notApplicable.push(rel);
    continue;
  }

  const found = resolveBoundCommit(data);
  const where = bindingLocation(data);

  if (found === null) {
    unbound.push({ rel, reason: `no commit recorded (${where})` });
    continue;
  }

  if (found === COMMIT) {
    bound.push(`${rel} [${where}]`);
  } else {
    mismatched.push({ rel, commit: found, where });
  }
}

// The identity record must ALSO be consistent across both of its own representations:
// the top-level binding envelope and the manifest it wraps describe the same commit.
const identityPath = join(DIR, 'identity', 'genetic-manifest.json');
if (existsSync(identityPath)) {
  try {
    const record = JSON.parse(readFileSync(identityPath, 'utf-8'));
    const envelope = record?.binding?.commit ?? null;
    if (envelope === COMMIT) {
      bound.push('identity/genetic-manifest.json [binding.commit, cross-checked]');
    } else if (envelope !== null) {
      mismatched.push({ rel: 'identity/genetic-manifest.json [binding.commit]', commit: envelope, where: 'binding.commit' });
    }
    // The identityId is DERIVED from the fingerprint. If the two disagree, one of them
    // was edited after generation - a different failure from a wrong commit binding.
    const fp = record?.manifest?.fingerprint ?? null;
    const id = record?.manifest?.identityId ?? null;
    if (fp && id && id !== `agi-${fp.slice(0, 16)}`) {
      inconsistencies.push(`identityId ${id} is not derived from fingerprint ${fp.slice(0, 16)}... (expected agi-${fp.slice(0, 16)})`);
    }
  } catch (err) {
    unparsable.push({ rel: 'identity/genetic-manifest.json', error: err.message });
  }
} else {
  unbound.push({ rel: 'identity/genetic-manifest.json', reason: 'missing' });
}

console.log('');
console.log(`[assert-binding] bound to ${COMMIT.slice(0, 12)}... : ${bound.length}`);
console.log(`[assert-binding] bound to a DIFFERENT commit        : ${mismatched.length}`);
console.log(`[assert-binding] unbound / null                     : ${unbound.length}`);
console.log(`[assert-binding] unparsable                         : ${unparsable.length}`);
console.log(`[assert-binding] not applicable (raw inputs)        : ${notApplicable.length}`);
console.log(`[assert-binding] internally inconsistent            : ${inconsistencies.length}`);

const failures = [];
for (const m of mismatched) {
  failures.push(
    `${m.rel} records ${String(m.commit).slice(0, 12)}... at ${m.where}, expected ${COMMIT.slice(0, 12)}...`,
  );
}
for (const u of unbound) failures.push(`${u.rel} is not bound (${u.reason})`);
for (const p of unparsable) failures.push(`${p.rel} is unparsable (${p.error})`);
for (const i of inconsistencies) failures.push(i);

if (bound.length === 0) {
  failures.push('no artifact at all is bound to the certified commit');
}

if (failures.length > 0) {
  console.error('');
  console.error(`[assert-binding] FAILED - ${failures.length} problem(s):`);
  for (const failure of failures.slice(0, 60)) console.error(`[assert-binding]   - ${failure}`);
  if (failures.length > 60) console.error(`[assert-binding]   ... and ${failures.length - 60} more`);
  process.exit(1);
}

console.log('');
console.log(`[assert-binding] PASS - every certification artifact is bound to ${COMMIT}`);
process.exit(0);
