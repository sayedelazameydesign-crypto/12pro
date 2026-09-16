import { describe, it, expect } from 'vitest';
import {
  decideExclusion,
  mustNeverRead,
  toRepoRelativePosixPath,
  EXCLUDED_PATH_PREFIXES,
  exclusionPolicySnapshot,
  HIDDEN_DIRECTORY_ALLOWLIST,
} from '@agi-system/identity';

describe('identity / exclusion policy', () => {
  it('excludes the whole certification subtree so records cannot feed themselves', () => {
    expect(decideExclusion('certification/identity/genetic-manifest.json').excluded).toBe(true);
    expect(decideExclusion('certification/gates/G16.json').excluded).toBe(true);
    expect(decideExclusion('certification/manifests/latest.json').excluded).toBe(true);
  });

  it('excludes every .env variant, including the example template', () => {
    for (const p of ['.env', '.env.local', '.env.example', 'configs/.env.production']) {
      expect(decideExclusion(p).excluded, p).toBe(true);
    }
  });

  it('excludes generated and dependency trees', () => {
    for (const p of ['node_modules/x/index.js', '.git/config', 'dist/a.js', 'packages/kernel/dist/a.js', 'coverage/lcov.info', '.turbo/cache']) {
      expect(decideExclusion(p).excluded, p).toBe(true);
    }
  });

  it('treats hidden directories as tooling scratch, not as source', () => {
    // The prefix list is enumerated, so an unnamed directory used to enter the genome.
    // That made the fingerprint depend on whatever a build or a verification script
    // left in the working tree - creating .fingerprint-out/ and recomputing produced a
    // DIFFERENT fingerprint, so the reproducibility check compared two different trees.
    for (const p of [
      '.fingerprint-out/genetic-manifest.json',
      '.fingerprint-out/fp1/genetic-manifest.json',
      '.scratch-probe/x.json',
      '.cache/anything',
      '.turbo/deep/nested/file.js',
    ]) {
      // Both the file and its directory must be excluded, and for the same reason.
      // The walk prunes the directory; a direct query about the file must agree.
      const fileDecision = decideExclusion(p);
      const dirDecision = decideExclusion(p.split('/').slice(0, -1).join('/') + '/');
      expect(fileDecision.excluded, p).toBe(true);
      expect(fileDecision.reason, p).toBe('hidden-directory');
      expect(dirDecision.excluded, `dir of ${p}`).toBe(true);
      expect(dirDecision.reason, `dir of ${p}`).toBe('hidden-directory');
    }
  });

  it('keeps .github, because workflows are source and part of the System Genome', () => {
    expect(HIDDEN_DIRECTORY_ALLOWLIST).toContain('.github');
    expect(decideExclusion('.github/').excluded).toBe(false);
    expect(decideExclusion('.github/workflows/').excluded).toBe(false);
    expect(decideExclusion('.github/workflows/certification.yml').excluded).toBe(false);
  });

  it('applies the hidden rule to directories only, never to dot-files', () => {
    // Dot-files at the repository root are configuration, i.e. source. Excluding them
    // would silently drop .gitignore from the genome.
    for (const p of ['.gitignore', '.eslintrc.json', '.prettierrc']) {
      expect(decideExclusion(p).excluded, p).toBe(false);
    }
  });

  it('excludes the named CI scratch directories used by certification.yml', () => {
    // Not hidden, so the dot-directory rule does not catch them. The verify-remote-binding
    // job downloads artifacts into certification-from-ci/ and compares them, which would
    // otherwise change the very fingerprint being checked.
    for (const p of ['certification-from-ci/', 'fingerprint-reproducibility/']) {
      expect(decideExclusion(p).excluded, p).toBe(true);
      expect(decideExclusion(p + 'anything.json').excluded, p).toBe(true);
    }
  });

  it('still counts a new named directory as source', () => {
    // The flip side of treating hidden dirs as scratch: a plainly named new directory is
    // new source and MUST change the fingerprint, otherwise adding a package would not
    // move the identity.
    expect(decideExclusion('packages/brand-new/').excluded).toBe(false);
    expect(decideExclusion('packages/brand-new/index.ts').excluded).toBe(false);
  });

  it('excludes build-info and log artifacts', () => {
    for (const p of ['tsconfig.tsbuildinfo', 'packages/x/foo.tsbuildinfo', 'debug.log', 'npm-debug.log']) {
      expect(decideExclusion(p).excluded, p).toBe(true);
    }
  });

  it('keeps real source, config, tests and workflows in the genome', () => {
    for (const p of [
      'packages/kernel/src/kernel.ts',
      'packages/identity/src/index.ts',
      'tests/unit/identity/merkle.test.ts',
      '.github/workflows/ci.yml',
      'package.json',
      'tsconfig.json',
      'scripts/identity/verify-genetic-fingerprint.js',
      'schemas/mission.schema.json',
    ]) {
      expect(decideExclusion(p).excluded, p).toBe(false);
    }
  });

  it('never reads secret containers even if they somehow reached the scan', () => {
    expect(mustNeverRead('.env')).toBe(true);
    expect(mustNeverRead('keys/id_rsa')).toBe(true);
    expect(mustNeverRead('cert.pem')).toBe(true);
    expect(mustNeverRead('packages/kernel/src/kernel.ts')).toBe(false);
  });

  it('normalizes windows separators and leading ./', () => {
    expect(toRepoRelativePosixPath('.\\packages\\kernel\\src\\kernel.ts')).toBe('packages/kernel/src/kernel.ts');
    expect(toRepoRelativePosixPath('./packages/x.ts')).toBe('packages/x.ts');
  });

  it('exposes a serializable, sorted policy snapshot for the manifest', () => {
    const snapshot = exclusionPolicySnapshot();
    expect(snapshot.pathPrefixes).toContain('certification/');
    expect(snapshot.pathPrefixes).toEqual([...snapshot.pathPrefixes].sort());
    expect(snapshot.pathPatterns.length).toBeGreaterThan(0);
    expect(EXCLUDED_PATH_PREFIXES.length).toBeGreaterThan(10);
  });
});
