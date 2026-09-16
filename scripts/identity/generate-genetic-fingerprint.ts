#!/usr/bin/env node
/**
 * Generate the genetic fingerprint for this repository.
 *
 * Run under Node >= 22.6 directly (type stripping), no build step:
 *
 *   node scripts/identity/generate-genetic-fingerprint.ts --commit=$GITHUB_SHA
 *
 * What it guarantees before it writes anything:
 *   - FP1 === FP2  (the fingerprint is computed twice, from scratch, and compared)
 *   - the fingerprint does NOT depend on the commit argument (circular-free)
 *
 * Commit binding is recorded in the non-hashed `binding` envelope only. It is
 * metadata for validation, never an input to the hash.
 *
 * IMPORTANT - CI is the only place a BOUND record is authoritative:
 *   Inside CI, pass --commit=$GITHUB_SHA. Outside CI, prefer --unbound, which
 *   writes commit:null. A record committed to git cannot be bound to the commit
 *   that contains it, so a committed bound record would always be stale by one
 *   commit. CI regenerates the bound record from the checkout it is verifying.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateGeneticIdentity,
  assertFingerprintIgnoresBinding,
  loadLineage,
  appendToLineage,
  createLineageEntry,
  writeLineage,
  verifyLineage,
  isCommitSha,
} from '../../packages/identity/src/index.ts';

interface Args {
  commit: string | null;
  commitSource: 'GITHUB_SHA' | 'git-rev-parse' | 'argument' | 'unbound';
  unbound: boolean;
  root: string;
  outDir: string;
  quiet: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let commitArg: string | null = null;
  let unbound = false;
  let rootArg: string | null = null;
  let outArg: string | null = null;
  let quiet = false;

  for (const raw of argv) {
    if (raw.startsWith('--commit=')) commitArg = raw.slice('--commit='.length);
    else if (raw === '--unbound') unbound = true;
    else if (raw.startsWith('--root=')) rootArg = raw.slice('--root='.length);
    else if (raw.startsWith('--out=')) outArg = raw.slice('--out='.length);
    else if (raw === '--quiet') quiet = true;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const root = rootArg ? resolve(rootArg) : resolve(here, '..', '..');

  let commit: string | null = null;
  let commitSource: Args['commitSource'] = 'unbound';

  if (unbound) {
    commit = null;
    commitSource = 'unbound';
  } else if (commitArg) {
    commit = commitArg.trim() || null;
    commitSource = 'argument';
  } else if (process.env.GITHUB_SHA) {
    commit = process.env.GITHUB_SHA.trim();
    commitSource = 'GITHUB_SHA';
  } else {
    try {
      commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8' }).trim();
      commitSource = 'git-rev-parse';
    } catch {
      commit = null;
      commitSource = 'unbound';
    }
  }

  return {
    commit,
    commitSource,
    unbound,
    root,
    outDir: outArg ? resolve(outArg) : join(root, 'certification', 'identity'),
    quiet,
  };
}

function log(args: Args, message: string): void {
  if (!args.quiet) console.log(message);
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));

  if (args.commit !== null && !isCommitSha(args.commit)) {
    console.error(
      `[identity] refusing to bind: "${args.commit}" is not a 40-hex commit SHA. ` +
        `A malformed binding is worse than no binding, because it looks verified.`,
    );
    return 2;
  }

  log(args, `[identity] root          : ${args.root}`);
  log(args, `[identity] commit        : ${args.commit ?? '(unbound)'} [source: ${args.commitSource}]`);

  // ---- FP1 ---------------------------------------------------------------
  const first = generateGeneticIdentity({
    root: args.root,
    commit: args.commit,
    commitSource: args.commitSource,
    generator: 'scripts/identity/generate-genetic-fingerprint.ts',
  });

  // ---- FP2: independent regeneration ------------------------------------
  const second = generateGeneticIdentity({
    root: args.root,
    commit: args.commit,
    commitSource: args.commitSource,
    generator: 'scripts/identity/generate-genetic-fingerprint.ts',
  });

  const fp1 = first.record.manifest.fingerprint;
  const fp2 = second.record.manifest.fingerprint;

  log(args, `[identity] FP1           : ${fp1}`);
  log(args, `[identity] FP2           : ${fp2}`);

  if (fp1 !== fp2) {
    console.error(`[identity] FATAL: fingerprint is not reproducible (FP1 != FP2). Refusing to write any artifact.`);
    console.error(`[identity]   FP1 ${fp1}`);
    console.error(`[identity]   FP2 ${fp2}`);
    return 1;
  }
  log(args, `[identity] FP1 === FP2   : true`);

  // ---- circular-freedom --------------------------------------------------
  const bindingStability = assertFingerprintIgnoresBinding(first.record);
  if (!bindingStability.stable) {
    console.error(`[identity] FATAL: fingerprint depends on the binding envelope - circular dependency present.`);
    console.error(`[identity]   A ${bindingStability.fingerprintA}`);
    console.error(`[identity]   B ${bindingStability.fingerprintB}`);
    return 1;
  }
  log(args, `[identity] binding-independent: true (commit/timestamp changes do not move the fingerprint)`);

  const manifest = first.record.manifest;
  log(args, `[identity] identityId    : ${manifest.identityId}`);
  log(args, `[identity] manifestHash  : ${manifest.manifestHash}`);
  log(args, `[identity] merkleRoot    : ${manifest.files.merkleRoot}`);
  log(args, `[identity] merkleDepth   : ${manifest.files.merkleDepth}`);
  log(args, `[identity] leafCount     : ${manifest.files.leafCount} (${manifest.files.totalBytes} bytes)`);
  log(args, `[identity] genomes       : system=${manifest.systemGenome.packages.length}pkgs core=${manifest.coreGenome.packageCount} agent=${manifest.agentGenome.packageCount} runtime=${manifest.runtimeGenome.packageCount}`);

  // ---- write artifacts ---------------------------------------------------
  mkdirSync(args.outDir, { recursive: true });

  const recordPath = join(args.outDir, 'genetic-manifest.json');
  writeFileSync(recordPath, `${JSON.stringify(first.record, null, 2)}\n`, 'utf-8');
  log(args, `[identity] wrote         : ${recordPath}`);

  // A compact, human-readable genome summary. Also excluded from the hash
  // (it lives under certification/), so it cannot perturb the fingerprint.
  const summary = {
    schemaVersion: manifest.schemaVersion,
    identityId: manifest.identityId,
    fingerprint: manifest.fingerprint,
    manifestHash: manifest.manifestHash,
    merkleRoot: manifest.files.merkleRoot,
    merkleDepth: manifest.files.merkleDepth,
    leafCount: manifest.files.leafCount,
    totalBytes: manifest.files.totalBytes,
    genomes: {
      system: {
        digest: manifest.systemGenome.digest,
        packages: manifest.systemGenome.packages.map((p) => ({ name: p.name, version: p.version, domain: p.domain, files: p.fileCount })),
        apps: manifest.systemGenome.apps.map((p) => p.name),
        services: manifest.systemGenome.services.map((p) => p.name),
        workflows: manifest.systemGenome.workflows.map((w) => ({
          path: w.path,
          jobs: w.jobs.length,
          nodeVersions: w.nodeVersions,
          hasHiddenFailure: w.hasHiddenFailure,
        })),
      },
      core: { digest: manifest.coreGenome.digest, packages: manifest.coreGenome.packages.map((p) => p.name) },
      agent: { digest: manifest.agentGenome.digest, packages: manifest.agentGenome.packages.map((p) => p.name) },
      runtime: { digest: manifest.runtimeGenome.digest, packages: manifest.runtimeGenome.packages.map((p) => p.name) },
    },
    exclusions: manifest.exclusions,
    binding: first.record.binding,
  };
  const summaryPath = join(args.outDir, 'genome.json');
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  log(args, `[identity] wrote         : ${summaryPath}`);

  // ---- lineage -----------------------------------------------------------
  const lineagePath = join(args.outDir, 'lineage.json');
  const existing = loadLineage(lineagePath);
  if (existing.parseError) {
    console.error(`[identity] WARNING: existing lineage was corrupt (${existing.parseError}); starting a new chain.`);
  }
  const entry = createLineageEntry({
    manifest,
    commit: args.commit,
    generatedAt: first.record.binding.generatedAt,
  });
  const lineage = appendToLineage(existing.lineage, entry);
  const lineageCheck = verifyLineage(lineage);
  if (!lineageCheck.valid) {
    console.error(`[identity] FATAL: lineage verification failed after append: ${lineageCheck.problems.join('; ')}`);
    return 1;
  }
  writeLineage(lineagePath, lineage);
  log(args, `[identity] wrote         : ${lineagePath} (${lineage.entries.length} entr(ies), chain valid)`);

  if (args.commit === null) {
    log(args, `[identity] NOTE: record is UNBOUND. This is expected for a committed artifact.`);
    log(args, `[identity]       CI regenerates a bound record from $GITHUB_SHA and that is the authoritative one.`);
  }

  return 0;
}

process.exit(main());
