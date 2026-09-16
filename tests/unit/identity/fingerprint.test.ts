import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  generateGeneticIdentity,
  assertFingerprintIgnoresBinding,
  computeFingerprint,
  computeManifestHash,
  deriveIdentityId,
  isSha256Hex,
} from '@agi-system/identity';

/** Build a minimal but structurally realistic repository fixture. */
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'genome-fixture-'));

  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '1.0.0', type: 'module', workspaces: ['packages/*'] }, null, 2),
  );
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }, null, 2));

  for (const pkg of ['kernel', 'identity', 'evidence', 'agent-core', 'runtime', 'providers']) {
    mkdirSync(join(root, 'packages', pkg, 'src'), { recursive: true });
    writeFileSync(
      join(root, 'packages', pkg, 'package.json'),
      JSON.stringify({ name: `@agi-system/${pkg}`, version: '0.1.0', type: 'module' }, null, 2),
    );
    writeFileSync(join(root, 'packages', pkg, 'src', 'index.ts'), `export const NAME = '${pkg}';\n`);
  }

  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n');
  writeFileSync(join(root, '.env.example'), 'MAX_SPEND=0\n');

  mkdirSync(join(root, 'tests', 'unit'), { recursive: true });
  writeFileSync(join(root, 'tests', 'unit', 'a.test.ts'), "export const x = 1;\n");

  return root;
}

describe('identity / fingerprint', () => {
  let root = '';

  beforeEach(() => {
    root = makeFixture();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('produces a well-formed 64-hex fingerprint and identity id', () => {
    const { record } = generateGeneticIdentity({ root });
    expect(isSha256Hex(record.manifest.fingerprint)).toBe(true);
    expect(isSha256Hex(record.manifest.manifestHash)).toBe(true);
    expect(isSha256Hex(record.manifest.files.merkleRoot)).toBe(true);
    expect(record.manifest.identityId).toMatch(/^agi-[0-9a-f]{16}$/);
  });

  it('is reproducible: FP1 === FP2 across independent regenerations', () => {
    const a = generateGeneticIdentity({ root });
    const b = generateGeneticIdentity({ root });
    expect(a.record.manifest.fingerprint).toBe(b.record.manifest.fingerprint);
    expect(a.record.manifest.manifestHash).toBe(b.record.manifest.manifestHash);
    expect(a.record.manifest.files.merkleRoot).toBe(b.record.manifest.files.merkleRoot);
  });

  it('does not depend on the commit argument (no commit -> fingerprint circularity)', () => {
    const a = generateGeneticIdentity({ root, commit: 'a'.repeat(40) });
    const b = generateGeneticIdentity({ root, commit: 'b'.repeat(40) });
    const c = generateGeneticIdentity({ root, commit: null });
    expect(a.record.manifest.fingerprint).toBe(b.record.manifest.fingerprint);
    expect(b.record.manifest.fingerprint).toBe(c.record.manifest.fingerprint);
    // ...but the binding envelope does record it, as metadata.
    expect(a.record.binding.commit).toBe('a'.repeat(40));
    expect(c.record.binding.commit).toBeNull();
  });

  it('assertFingerprintIgnoresBinding proves independence from the whole envelope', () => {
    const { record } = generateGeneticIdentity({ root });
    const result = assertFingerprintIgnoresBinding(record);
    expect(result.stable).toBe(true);
    expect(result.fingerprintA).toBe(result.fingerprintB);
  });

  it('does not move when certification output is written into the tree', () => {
    const before = generateGeneticIdentity({ root }).record.manifest.fingerprint;

    mkdirSync(join(root, 'certification', 'identity'), { recursive: true });
    mkdirSync(join(root, 'certification', 'gates'), { recursive: true });
    writeFileSync(join(root, 'certification', 'identity', 'genetic-manifest.json'), '{"fingerprint":"anything"}');
    writeFileSync(join(root, 'certification', 'identity', 'lineage.json'), '{"entries":[]}');
    writeFileSync(join(root, 'certification', 'gates', 'G16.json'), '{"status":"PASS"}');

    const after = generateGeneticIdentity({ root }).record.manifest.fingerprint;
    expect(after).toBe(before);
  });

  it('does not move when generated machine state appears', () => {
    const before = generateGeneticIdentity({ root }).record.manifest.fingerprint;

    mkdirSync(join(root, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'dep', 'index.js'), 'module.exports = 1;');
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'bundle.js'), 'built');
    mkdirSync(join(root, 'coverage'), { recursive: true });
    writeFileSync(join(root, 'coverage', 'lcov.info'), 'SF:x');
    writeFileSync(join(root, 'tsconfig.tsbuildinfo'), '{}');

    const after = generateGeneticIdentity({ root }).record.manifest.fingerprint;
    expect(after).toBe(before);
  });

  it('DOES move when a real source file changes - the genome is not vacuous', () => {
    const before = generateGeneticIdentity({ root }).record.manifest.fingerprint;
    const target = join(root, 'packages', 'kernel', 'src', 'index.ts');
    const original = readFileSync(target, 'utf-8');

    writeFileSync(target, `${original}export const EXTRA = true;\n`);
    const after = generateGeneticIdentity({ root }).record.manifest.fingerprint;
    expect(after).not.toBe(before);

    writeFileSync(target, original);
    const restored = generateGeneticIdentity({ root }).record.manifest.fingerprint;
    expect(restored).toBe(before);
  });

  it('DOES move when a package is added', () => {
    const before = generateGeneticIdentity({ root }).record.manifest.fingerprint;
    mkdirSync(join(root, 'packages', 'autonomy', 'src'), { recursive: true });
    writeFileSync(join(root, 'packages', 'autonomy', 'package.json'), JSON.stringify({ name: '@agi-system/autonomy', version: '0.1.0' }));
    writeFileSync(join(root, 'packages', 'autonomy', 'src', 'index.ts'), 'export const A = 1;\n');
    const after = generateGeneticIdentity({ root }).record.manifest.fingerprint;
    expect(after).not.toBe(before);
  });

  it('assigns packages to the core, agent and runtime genomes', () => {
    const { record } = generateGeneticIdentity({ root });
    expect(record.manifest.coreGenome.packages.map((p) => p.name)).toContain('@agi-system/kernel');
    expect(record.manifest.coreGenome.packages.map((p) => p.name)).toContain('@agi-system/identity');
    expect(record.manifest.agentGenome.packages.map((p) => p.name)).toContain('@agi-system/agent-core');
    expect(record.manifest.runtimeGenome.packages.map((p) => p.name)).toContain('@agi-system/runtime');
  });

  it('records allow-listed packages that are absent instead of hiding them', () => {
    const { record } = generateGeneticIdentity({ root });
    // The fixture has no autonomy package, but the runtime allow-list requests it.
    expect(record.manifest.runtimeGenome.missing).toContain('@agi-system/autonomy');
  });

  it('detects CI workflows that can swallow their own failures', () => {
    const hidden = join(root, '.github', 'workflows', 'sneaky.yml');
    writeFileSync(hidden, 'name: Sneaky\njobs:\n  a:\n    steps:\n      - run: npm test || echo "fine"\n');
    const { record } = generateGeneticIdentity({ root });
    const workflows = record.manifest.systemGenome.workflows;
    expect(workflows.find((w) => w.path.endsWith('sneaky.yml'))?.hasHiddenFailure).toBe(true);
    expect(workflows.find((w) => w.path.endsWith('ci.yml'))?.hasHiddenFailure).toBe(false);
  });

  it('reads the MAX_SPEND policy without fingerprinting the .env file', () => {
    const { record } = generateGeneticIdentity({ root });
    // .env.example is excluded from the leaves...
    expect(record.binding.diagnostics.leafCount).toBeGreaterThan(0);
    const hasEnvLeaf = JSON.stringify(record.manifest.systemGenome.config).includes('.env.example');
    expect(hasEnvLeaf).toBe(false);
  });

  it('derives the fingerprint from the manifest hash with domain separation', () => {
    const materialHash = computeManifestHash({
      schemaVersion: '1.0.0',
      systemGenome: { packages: [], apps: [], services: [], workflows: [], config: [], rootDocs: [], schemas: [], tests: [], evaluations: [], benchmarks: [], scripts: [], digest: 'd' },
      coreGenome: { domain: 'core', packageCount: 0, packages: [], missing: [], digest: 'd' },
      agentGenome: { domain: 'agent', packageCount: 0, packages: [], missing: [], digest: 'd' },
      runtimeGenome: { domain: 'runtime', packageCount: 0, packages: [], missing: [], digest: 'd' },
      files: { leafCount: 0, totalBytes: 0, merkleRoot: 'r', merkleDepth: 0 },
      exclusions: { pathPrefixes: [], pathPatterns: [] },
    });
    const fp = computeFingerprint(materialHash);
    expect(isSha256Hex(fp)).toBe(true);
    // Domain separation: the fingerprint must not equal the bare material hash.
    expect(fp).not.toBe(materialHash);
    expect(deriveIdentityId(fp)).toBe(`agi-${fp.slice(0, 16)}`);
  });

  it('refuses to derive an identity id from a malformed fingerprint', () => {
    expect(() => deriveIdentityId('not-a-hash')).toThrow(/64-hex/);
  });
});
