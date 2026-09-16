#!/usr/bin/env node
/**
 * License check.
 *
 * The previous version printed:
 *     '[license-check] No disallowed licenses found (simulated) - PASS'
 * It inspected nothing. A simulated pass in a supply-chain gate is worse than no
 * gate, because it is read downstream as evidence.
 *
 * This version reads the licenses of the packages that are ACTUALLY installed in
 * node_modules (the real shipped dependency set), compares them against the allowed
 * list, and reports every package whose license is unknown or disallowed.
 *
 * Exit codes: 0 = all allowed, 1 = disallowed/unknown licenses found, 2 = no tree to inspect.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = new Set([
  'MIT',
  'Apache-2.0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'Python-2.0',
  'Unlicense',
  'BlueOak-1.0.0',
]);

const strict = process.argv.includes('--strict');
const NODE_MODULES = 'node_modules';

console.log('[license-check] inspecting the installed dependency tree (not a simulation)');
console.log(`[license-check] allowed licenses: ${[...ALLOWED].sort().join(', ')}`);

if (!existsSync(NODE_MODULES)) {
  console.error(`[license-check] ${NODE_MODULES} does not exist - run \`npm ci\` first.`);
  console.error('[license-check] Refusing to report a pass without a dependency tree to inspect.');
  process.exit(2);
}

/** Every installed package.json, including scoped packages. */
function collectPackageJsons(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      for (const scoped of readdirSync(full, { withFileTypes: true })) {
        if (!scoped.isDirectory()) continue;
        const pkg = join(full, scoped.name, 'package.json');
        if (existsSync(pkg)) out.push(pkg);
      }
      continue;
    }
    if (!entry.isDirectory()) continue;
    const pkg = join(full, 'package.json');
    if (existsSync(pkg)) out.push(pkg);
    // Nested node_modules (non-hoisted installs).
    const nested = join(full, 'node_modules');
    if (existsSync(nested)) out.push(...collectPackageJsons(nested));
  }
  return out;
}

const files = collectPackageJsons(NODE_MODULES);
console.log(`[license-check] installed packages found: ${files.length}`);

if (files.length === 0) {
  console.error('[license-check] found no installed packages - nothing was inspected, so nothing passed.');
  process.exit(2);
}

const disallowed = [];
const unknown = [];
const seen = new Map();

for (const file of files) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    unknown.push({ name: file, license: '(unparsable package.json)' });
    continue;
  }
  const name = pkg.name ?? file;
  const version = pkg.version ?? '?';
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? null;

  if (seen.has(`${name}@${version}`)) continue;
  seen.set(`${name}@${version}`, license);

  if (!license) {
    unknown.push({ name: `${name}@${version}`, license: '(none declared)' });
    continue;
  }
  // Some packages declare "(MIT OR Apache-2.0)"; accept when every option is allowed.
  const parts = license
    .replace(/[()]/g, '')
    .split(/\s+(?:OR|AND)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const allAllowed = parts.length > 0 && parts.every((p) => ALLOWED.has(p));
  if (!allAllowed) {
    disallowed.push({ name: `${name}@${version}`, license });
  }
}

const licenseHistogram = new Map();
for (const license of seen.values()) {
  const key = license ?? '(none)';
  licenseHistogram.set(key, (licenseHistogram.get(key) ?? 0) + 1);
}

console.log('[license-check] license distribution:');
for (const [license, count] of [...licenseHistogram.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`[license-check]   ${String(count).padStart(4)}  ${license}`);
}

for (const entry of disallowed) {
  console.error(`[license-check] DISALLOWED ${entry.name} -> ${entry.license}`);
}
for (const entry of unknown) {
  console.warn(`[license-check] UNKNOWN    ${entry.name} -> ${entry.license}`);
}

const failOnUnknown = strict && unknown.length > 0;

if (disallowed.length > 0 || failOnUnknown) {
  console.error('');
  console.error(
    `[license-check] FAIL: ${disallowed.length} disallowed license(s), ${unknown.length} undeclared${strict ? ' (strict: undeclared counts as failure)' : ''}`,
  );
  process.exit(1);
}

if (unknown.length > 0) {
  console.warn(`[license-check] ${unknown.length} package(s) declare no license - reported, not counted as allowed.`);
}

console.log(`[license-check] PASS: ${seen.size} unique package version(s) inspected, ${disallowed.length} disallowed.`);
console.log('[license-check] This result comes from reading installed package manifests, not from a simulation.');
process.exit(0);
