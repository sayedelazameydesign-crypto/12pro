#!/usr/bin/env node
/**
 * Render (or verify) the dynamic numbers in certification/reports/FINAL-CERTIFICATION.md.
 *
 * A hand-written certification document drifts: someone edits a gate, the numbers in the
 * prose stay behind, and the document quietly starts lying. This script removes the
 * possibility by deriving every number in the snapshot tables from the artifacts, and by
 * offering a --check mode that fails when the committed document disagrees with them.
 *
 * Prose is left alone. Only the table rows this script owns are rewritten, and each is
 * matched by a stable pattern rather than by position.
 *
 * Usage:
 *   node scripts/certification/render-final-report.js            # rewrite the numbers
 *   node scripts/certification/render-final-report.js --check    # fail if they disagree
 *
 * --check is an AUTHORING tool, run before committing. It deliberately does NOT run in
 * CI: the document quotes one local snapshot, while CI generates artifacts for a
 * different commit, so the commit and fingerprint rows would disagree by construction.
 * What CI guarantees instead is that the artifacts themselves are bound and consistent
 * (assert-binding.js, closure-statement.js) - and the document says in its first line
 * that it is not the certification.
 *
 * Exit codes: 0 = rendered / consistent, 1 = --check found a disagreement or a row
 *             could not be located, 2 = artifacts missing.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHECK = process.argv.includes('--check');
const ROOT = resolve(process.argv.find((a) => a.startsWith('--root='))?.split('=')[1] ?? '.');
const DOC = join(ROOT, 'certification', 'reports', 'FINAL-CERTIFICATION.md');

function readJson(path, label) {
  if (!existsSync(path)) {
    console.error(`[final-report] missing artifact: ${label} (${path})`);
    console.error('[final-report] run `npm run certify` first - there is nothing to render from.');
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    console.error(`[final-report] ${label} is unparsable: ${err.message}`);
    process.exit(2);
  }
}

const identity = readJson(join(ROOT, 'certification', 'identity', 'genetic-manifest.json'), 'genetic-manifest');
const genome = readJson(join(ROOT, 'certification', 'identity', 'genome.json'), 'genome');
const lineage = readJson(join(ROOT, 'certification', 'identity', 'lineage.json'), 'lineage');
const manifest = readJson(join(ROOT, 'certification', 'manifests', 'latest.json'), 'manifest');

if (!existsSync(DOC)) {
  console.error(`[final-report] ${DOC} does not exist`);
  process.exit(2);
}

const m = identity.manifest;
const diag = identity.binding.diagnostics ?? {};
const gs = genome.genomes;

/** Every row this script owns: a stable matcher and the exact replacement text. */
const ROWS = [
  {
    label: 'Commit',
    match: /^\| Commit \| `[0-9a-f]{40}` \|$/m,
    value: `| Commit | \`${manifest.commit}\` |`,
  },
  {
    label: 'Ran in CI',
    match: /^\| Ran in CI \| .* \|$/m,
    value: `| Ran in CI | ${manifest.ci === true ? '**yes**' : '**no**'} |`,
  },
  { label: 'Fingerprint', match: /^\| Fingerprint \| `[0-9a-f]{64}` \|$/m, value: `| Fingerprint | \`${m.fingerprint}\` |` },
  { label: 'Identity id', match: /^\| Identity id \| `agi-[0-9a-f]{16}` \|$/m, value: `| Identity id | \`${m.identityId}\` |` },
  { label: 'Manifest hash', match: /^\| Manifest hash \| `[0-9a-f]{64}` \|$/m, value: `| Manifest hash | \`${m.manifestHash}\` |` },
  { label: 'Merkle root', match: /^\| Merkle root \| `[0-9a-f]{64}` \|$/m, value: `| Merkle root | \`${m.files.merkleRoot}\` |` },
  { label: 'Merkle depth', match: /^\| Merkle depth \| \d+ \|$/m, value: `| Merkle depth | ${m.files.merkleDepth} |` },
  {
    label: 'Genome leaves',
    match: /^\| Genome leaves \| .* \|$/m,
    value: `| Genome leaves | ${m.files.leafCount.toLocaleString('en-US')} files / ${m.files.totalBytes.toLocaleString('en-US')} bytes |`,
  },
  {
    label: 'Excluded',
    match: /^\| Excluded \| .* \|$/m,
    value: `| Excluded | ${diag.excludedFileCount ?? 0} files, ${diag.prunedDirectoryCount ?? 0} pruned directories |`,
  },
  {
    label: 'Lineage entries',
    match: /^\| Lineage entries \| .* \|$/m,
    value: `| Lineage entries | ${lineage.entries.length} (append-only, tip = this fingerprint) |`,
  },
  {
    label: 'System genome',
    match: /^\| System \| .* \| `[0-9a-f]{8}…` \|$/m,
    value: `| System | ${gs.system.packages.length} packages, ${gs.system.workflows.length} workflows, config + test surfaces | \`${gs.system.digest.slice(0, 8)}…\` |`,
  },
  {
    label: 'Core genome',
    match: /^\| Core \| .* \| `[0-9a-f]{8}…` \|$/m,
    value: `| Core | ${gs.core.packages.length} allow-listed packages | \`${gs.core.digest.slice(0, 8)}…\` |`,
  },
  {
    label: 'Agent genome',
    match: /^\| Agent \| .* \| `[0-9a-f]{8}…` \|$/m,
    value: `| Agent | ${gs.agent.packages.length} allow-listed packages | \`${gs.agent.digest.slice(0, 8)}…\` |`,
  },
  {
    label: 'Runtime genome',
    match: /^\| Runtime \| .* \| `[0-9a-f]{8}…` \|$/m,
    value: `| Runtime | ${gs.runtime.packages.length} allow-listed packages | \`${gs.runtime.digest.slice(0, 8)}…\` |`,
  },
];

// Gate table rows: one per gate, rendered from the gate artifacts themselves.
const GATE_LABELS = {
  G0: 'lint, typecheck, build',
  G1: 'unit tests',
  G2: 'integration',
  G3: 'security tests',
  G4: 'contract',
  G5: 'E2E',
  G6: 'stress',
  G7: 'chaos',
  G8: 'benchmarks',
  G9: 'acceptance',
  G10: 'governance + supply chain',
  G11: 'documentation',
  G12: 'release readiness',
  G13: 'long-horizon evaluation',
  G14: 'safety evaluation',
  G15: 'kernel invariants',
  G16: 'genetic identity',
};

for (const [gate, label] of Object.entries(GATE_LABELS)) {
  const artifactPath = join(ROOT, 'certification', 'gates', `${gate}.json`);
  if (!existsSync(artifactPath)) continue;
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(artifactPath, 'utf-8'));
  } catch {
    continue;
  }
  const summary = manifest.gates?.[gate];
  if (!summary) continue;

  const num = (v) => (typeof v === 'number' ? String(v) : 'n/a');
  let evidence;
  if (Array.isArray(artifact.checks)) {
    evidence = `${num(artifact.passed)}/${num(artifact.tests)} checks`;
  } else if (typeof artifact.tests === 'number' && typeof artifact.passed === 'number') {
    evidence = `${artifact.passed}/${artifact.tests}`;
  } else if (typeof artifact.tests === 'number') {
    // A PARTIAL gate with no pass count (the E2E placeholder) must not render as
    // "n/a/1", which reads like a fraction. Say what it is.
    evidence = `no pass count (${artifact.tests} file(s))`;
  } else {
    evidence = 'n/a';
  }

  const status = summary.status === 'PASS' ? 'PASS' : summary.status === 'PARTIAL' ? '**PARTIAL**' : summary.status === 'FAIL' ? '**FAIL**' : 'NOT_CERTIFIED';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  ROWS.push({
    label: `Gate ${gate}`,
    match: new RegExp(`^\\| ${gate} \\| ${escaped} \\| .* \\| .* \\| (yes|no) \\|$`, 'm'),
    value: `| ${gate} | ${label} | ${status} | ${evidence} | ${summary.blocking ? 'yes' : 'no'} |`,
  });
}

// Benchmark rows.
for (const name of ['latency', 'memory', 'planning', 'tool-use', 'long-horizon']) {
  const path = join(ROOT, 'certification', 'benchmarks', `${name}.json`);
  if (!existsSync(path)) continue;
  let bench;
  try {
    bench = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    continue;
  }
  const metrics = bench.metrics ?? {};
  const f2 = (v) => (typeof v === 'number' ? v.toFixed(2) : null);
  let detail;
  if (bench.status === 'NOT_MEASURED') {
    detail = '—';
  } else if (name === 'latency') {
    detail = `p50 **${f2(metrics.p50_ms)} ms**, p95 **${f2(metrics.p95_ms)} ms**, p99 **${f2(metrics.p99_ms)} ms**, mean ${f2(metrics.mean_ms)} ms, range ${f2(metrics.min_ms)}–${f2(metrics.max_ms)} ms`;
  } else if (name === 'memory') {
    detail = `heapUsed **${f2(metrics.heapUsedMB)} MB**, heapTotal ${f2(metrics.heapTotalMB)} MB, RSS ${f2(metrics.rssMB)} MB, heap delta ${f2(metrics.heapDeltaMB)} MB`;
  } else if (name === 'planning') {
    detail = `mean **${f2(metrics.mean_ms)} ms**, p95 ${f2(metrics.p95_ms)} ms, min ${f2(metrics.min_ms)} ms, max ${f2(metrics.max_ms)} ms`;
  } else {
    continue;
  }
  const statusText = bench.status === 'PASS' ? 'PASS' : `**${bench.status}**`;
  ROWS.push({
    label: `Benchmark ${name}`,
    match: new RegExp(`^\\| ${name} \\| (PASS|\\*\\*NOT_MEASURED\\*\\*) \\| .* \\|$`, 'm'),
    value: `| ${name} | ${statusText} | ${detail} |`,
  });
}

let doc = readFileSync(DOC, 'utf-8');
const missing = [];
const changed = [];

for (const row of ROWS) {
  const current = row.match.exec(doc)?.[0];
  if (current === undefined) {
    missing.push(row.label);
    continue;
  }
  if (current !== row.value) {
    changed.push({ label: row.label, from: current, to: row.value });
    doc = doc.replace(row.match, row.value.replace(/\$/g, '$$$$'));
  }
}

// The secret-scan sentence quotes the leaf count too.
const scanSentence = /^\d+ files scanned against 13 rules\./m;
const scanValue = `${m.files.leafCount} files scanned against 13 rules.`;
const scanCurrent = scanSentence.exec(doc)?.[0];
if (scanCurrent === undefined) {
  missing.push('secret-scan leaf count');
} else if (scanCurrent !== scanValue) {
  changed.push({ label: 'secret-scan leaf count', from: scanCurrent, to: scanValue });
  doc = doc.replace(scanSentence, scanValue);
}

if (missing.length > 0) {
  console.error(`[final-report] could not locate ${missing.length} row(s) in ${DOC}:`);
  for (const label of missing) console.error(`[final-report]   - ${label}`);
  console.error('[final-report] The document structure changed; update the matchers in this script.');
  process.exit(1);
}

if (CHECK) {
  if (changed.length > 0) {
    console.error(`[final-report] CHECK FAILED - ${changed.length} value(s) in the document disagree with the artifacts:`);
    for (const change of changed) {
      console.error(`[final-report]   ${change.label}`);
      console.error(`[final-report]     document : ${change.from}`);
      console.error(`[final-report]     artifact : ${change.to}`);
    }
    console.error('[final-report] Run without --check to render them, then commit the result.');
    process.exit(1);
  }
  console.log(`[final-report] CHECK PASS - all ${ROWS.length + 1} derived value(s) agree with the artifacts`);
  console.log(`[final-report] fingerprint ${m.fingerprint}`);
  process.exit(0);
}

writeFileSync(DOC, doc, 'utf-8');
console.log(`[final-report] rendered ${changed.length} value(s) into ${DOC}`);
for (const change of changed) console.log(`[final-report]   ${change.label}: ${change.to.slice(0, 96)}`);
console.log(`[final-report] fingerprint ${m.fingerprint} | identityId ${m.identityId} | leaves ${m.files.leafCount}`);
process.exit(0);
