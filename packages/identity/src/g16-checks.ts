/**
 * G16 - Genetic Identity Gate: the eighteen checks.
 *
 * Every check is COMPUTED, never asserted. The engine independently re-derives the
 * genome from the working tree and compares it against the stored record, so a
 * hand-edited or stale manifest cannot pass.
 *
 * The check count is derived from the array length. It is never written as a
 * literal in a report, which is how "12/18" style inconsistencies become
 * impossible: `total`, `passed` and `failed` are all counted from real results.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalJson } from './canonical.ts';
import { sha256Hex, isSha256Hex, isCommitSha } from './hashing.ts';
import { buildMerkleTree, inclusionProof, sortLeaves } from './merkle.ts';
import { scanRepository } from './scan.ts';
import { scanRepositoryForSecrets, secretRuleInventory } from './secrets.ts';
import { SECRET_ALLOWLIST, partitionFindings, findStaleAllowlistEntries } from './secret-allowlist.ts';
import { exclusionPolicySnapshot, decideExclusion } from './exclusions.ts';
import { generateGeneticIdentity, sealManifest } from './fingerprint.ts';
import { verifyLineage, loadLineage } from './lineage.ts';
import { readMaxSpendPolicy, detectProviders, CORE_GENOME_PACKAGES, AGENT_GENOME_PACKAGES } from './genome.ts';
import type { CheckResult, GeneticIdentityRecord, GeneticManifest } from './types.ts';

/** Paths that MUST exist for the genetic identity layer to be considered real. */
export const REQUIRED_PATHS: readonly string[] = [
  'packages/identity/package.json',
  'packages/identity/src/index.ts',
  'packages/identity/src/canonical.ts',
  'packages/identity/src/merkle.ts',
  'packages/identity/src/genome.ts',
  'packages/identity/src/fingerprint.ts',
  'packages/identity/src/lineage.ts',
  'packages/identity/src/secrets.ts',
  'packages/identity/src/exclusions.ts',
  'packages/autonomy/package.json',
  'packages/autonomy/src/index.ts',
  'packages/autonomy/src/supervisor.ts',
  'packages/autonomy/src/promotion.ts',
  'packages/providers/src/registry.ts',
  'packages/providers/src/local-first.ts',
  'packages/providers/src/spend-policy.ts',
  'packages/providers/src/providers/ollama.ts',
  'packages/providers/src/providers/nvidia.ts',
  'packages/providers/src/providers/gemini.ts',
  'packages/providers/src/providers/groq.ts',
  'packages/providers/src/providers/huggingface.ts',
  'scripts/identity/generate-genetic-fingerprint.ts',
  'scripts/identity/verify-genetic-fingerprint.js',
  'certification/identity/genetic-manifest.json',
  'certification/identity/lineage.json',
  '.env.example',
];

/** Keys that must never appear anywhere in the hashed genome material. */
export const FORBIDDEN_HASHED_KEYS: readonly string[] = ['commit', 'generatedAt', 'timestamp', 'durationMs'];

export interface G16Input {
  root: string;
  /** Commit this certification claims to describe. */
  expectedCommit: string | null;
  /** When true, commit binding is mandatory (CI). */
  requireCommitBinding: boolean;
  /** Path to the stored identity record. */
  recordPath?: string;
  /** Path to the lineage file. */
  lineagePath?: string;
  /** Certification artifacts whose `commit` field must match `expectedCommit`. */
  evidencePaths?: readonly string[];
}

export interface G16Report {
  gate: 'G16';
  name: string;
  description: string;
  checks: CheckResult[];
  /** Counted, never hardcoded. */
  total: number;
  passed: number;
  failed: number;
  status: 'PASS' | 'FAIL';
  fingerprint: string | null;
  identityId: string | null;
  manifestHash: string | null;
  merkleRoot: string | null;
  leafCount: number;
  secretRuleCount: number;
}

function pass(id: string, name: string, detail: string, evidence?: Record<string, unknown>): CheckResult {
  return { id, name, status: 'PASS', detail, evidence };
}
function fail(id: string, name: string, detail: string, evidence?: Record<string, unknown>): CheckResult {
  return { id, name, status: 'FAIL', detail, evidence };
}

/** Deep scan for forbidden keys anywhere in the hashed material. */
function findForbiddenKeys(value: unknown, path = '$', found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, i) => findForbiddenKeys(item, `${path}[${i}]`, found));
    return found;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_HASHED_KEYS.includes(key)) found.push(`${path}.${key}`);
      findForbiddenKeys(child, `${path}.${key}`, found);
    }
  }
  return found;
}

/** Load a JSON file, returning null plus an error string when unusable. */
function loadJson(filePath: string): { data: unknown; error: string | null } {
  if (!existsSync(filePath)) return { data: null, error: `missing file: ${filePath}` };
  try {
    return { data: JSON.parse(readFileSync(filePath, 'utf-8')), error: null };
  } catch (err) {
    return { data: null, error: `unparsable JSON in ${filePath}: ${(err as Error).message}` };
  }
}

/** Run all eighteen G16 checks. */
export function runG16Checks(input: G16Input): G16Report {
  const root = input.root;
  const recordPath = input.recordPath ?? join(root, 'certification/identity/genetic-manifest.json');
  const lineagePath = input.lineagePath ?? join(root, 'certification/identity/lineage.json');

  const checks: CheckResult[] = [];

  // ---------------------------------------------------------------- load record
  const stored = loadJson(recordPath) as { data: GeneticIdentityRecord | null; error: string | null };
  const record = stored.data;
  const manifest: GeneticManifest | null = record?.manifest ?? null;

  // Independent regeneration from the tree. This is what every comparison uses,
  // so the stored manifest is never trusted on its own.
  const fresh = generateGeneticIdentity({
    root,
    commit: input.expectedCommit,
    commitSource: input.expectedCommit ? 'argument' : 'unbound',
  });
  const freshManifest = fresh.record.manifest;

  // ------------------------------------------------------- 1. fingerprint-valid
  {
    const id = 'fingerprint-valid';
    const name = 'Mission fingerprint is well-formed and consistent';
    if (!manifest) {
      checks.push(fail(id, name, stored.error ?? 'no stored manifest'));
    } else if (!isSha256Hex(manifest.fingerprint)) {
      checks.push(fail(id, name, `fingerprint is not 64-hex: ${String(manifest.fingerprint)}`));
    } else if (manifest.fingerprint !== freshManifest.fingerprint) {
      checks.push(
        fail(id, name, `stored fingerprint ${manifest.fingerprint.slice(0, 12)}... does not match the tree, which yields ${freshManifest.fingerprint.slice(0, 12)}...`, {
          stored: manifest.fingerprint,
          recomputed: freshManifest.fingerprint,
        }),
      );
    } else {
      checks.push(pass(id, name, `fingerprint ${manifest.fingerprint} matches the current tree`, {
        fingerprint: manifest.fingerprint,
        identityId: manifest.identityId,
      }));
    }
  }

  // ----------------------------------------------------- 2. manifest-hash-valid
  {
    const id = 'manifest-hash-valid';
    const name = 'Manifest hash recomputes from canonical material';
    if (!manifest) {
      checks.push(fail(id, name, stored.error ?? 'no stored manifest'));
    } else {
      const material = {
        schemaVersion: manifest.schemaVersion,
        systemGenome: manifest.systemGenome,
        coreGenome: manifest.coreGenome,
        agentGenome: manifest.agentGenome,
        runtimeGenome: manifest.runtimeGenome,
        files: manifest.files,
        exclusions: manifest.exclusions,
      };
      const recomputed = sha256Hex(canonicalJson(material));
      if (recomputed !== manifest.manifestHash) {
        checks.push(fail(id, name, `stored manifestHash ${String(manifest.manifestHash).slice(0, 12)}... != recomputed ${recomputed.slice(0, 12)}...`, {
          stored: manifest.manifestHash,
          recomputed,
        }));
      } else {
        checks.push(pass(id, name, `manifestHash ${manifest.manifestHash} recomputes exactly`, { manifestHash: recomputed }));
      }
    }
  }

  // ------------------------------------------------------------ 3. lineage-valid
  const loadedLineage = loadLineage(lineagePath);
  const lineageVerification = verifyLineage(loadedLineage.lineage);
  {
    const id = 'lineage-valid';
    const name = 'Lineage chain is intact';
    if (loadedLineage.parseError) {
      checks.push(fail(id, name, `lineage file is corrupt: ${loadedLineage.parseError}`));
    } else if (!lineageVerification.valid) {
      checks.push(fail(id, name, `${lineageVerification.problems.length} lineage problem(s): ${lineageVerification.problems.join('; ')}`));
    } else if (manifest && lineageVerification.tip && lineageVerification.tip.fingerprint !== manifest.fingerprint) {
      checks.push(fail(id, name, `lineage tip ${lineageVerification.tip.fingerprint.slice(0, 12)}... does not match manifest fingerprint ${manifest.fingerprint.slice(0, 12)}...`));
    } else {
      checks.push(pass(id, name, `lineage intact with ${lineageVerification.entryCount} entr(ies), tip ${lineageVerification.tip?.fingerprint.slice(0, 12)}...`, {
        entryCount: lineageVerification.entryCount,
      }));
    }
  }

  // ----------------------------------------------------- 4. no-secret-material
  {
    const id = 'no-secret-material';
    const name = 'No secret material in the genome';
    const scan = scanRepository({ root });
    const secretScan = scanRepositoryForSecrets(scan.leaves, root);
    const envLeaves = scan.leaves.filter((l) => /(^|\/)\.env(\.|$)/.test(l.path)).map((l) => l.path);
    // certification/ is excluded by prefix, so this must be 0. It was computed and then
    // discarded while the PASS message asserted "certification/ excluded from leaves"
    // from a hardcoded string - a claim the check did not actually make. Asserting it
    // turns the sentence into evidence.
    const certLeaves = scan.leaves.filter((l) => l.path.startsWith('certification/'));

    const { explained, unexplained } = partitionFindings(secretScan.findings);
    const stale = findStaleAllowlistEntries(secretScan.findings);

    const problems: string[] = [];
    if (unexplained.length > 0) {
      problems.push(
        `${unexplained.length} unexplained secret finding(s): ${unexplained
          .slice(0, 5)
          .map((f) => `${f.path}:${f.line} ${f.ruleId} ${f.redactedExcerpt}`)
          .join(', ')}`,
      );
    }
    if (envLeaves.length > 0) problems.push(`.env material reached the genome: ${envLeaves.join(', ')}`);
    if (certLeaves.length > 0) {
      problems.push(
        `${certLeaves.length} certification/ leaf(leaves) reached the genome, which makes the fingerprint depend on ` +
          `its own output: ${certLeaves.slice(0, 5).map((l) => l.path).join(', ')}`,
      );
    }
    if (stale.length > 0) {
      problems.push(
        `${stale.length} allow-list entr(ies) no longer match anything and must be removed: ${stale
          .map((e) => `${e.path}/${e.ruleId}`)
          .join(', ')}`,
      );
    }

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | '), {
        findings: secretScan.findings.length,
        explained: explained.length,
        unexplained: unexplained.length,
        rules: secretRuleInventory().length,
        scannedFiles: secretScan.scannedFiles,
        certificationLeaves: certLeaves.length,
      }));
    } else {
      checks.push(
        pass(
          id,
          name,
          `${secretScan.scannedFiles} file(s) scanned against ${secretRuleInventory().length} secret rules; ` +
            `${unexplained.length} unexplained finding(s); ${explained.length} finding(s) matched the reviewed allow-list ` +
            `(CI-local service credentials and one negative test fixture); ${envLeaves.length} .env leaves; ` +
            `${certLeaves.length} certification/ leaves (both asserted to be 0, not assumed)`,
          {
            scannedFiles: secretScan.scannedFiles,
            rules: secretRuleInventory().length,
            findings: secretScan.findings.length,
            explained: explained.length,
            unexplained: unexplained.length,
            allowlistEntries: SECRET_ALLOWLIST.length,
            staleAllowlistEntries: stale.length,
            blockedPaths: secretScan.blockedPaths.length,
            envLeaves: envLeaves.length,
            certificationLeaves: certLeaves.length,
          },
        ),
      );
    }
  }

  // ----------------------------------------------------------- 5. commit-bound
  {
    const id = 'commit-bound';
    const name = 'Record is bound to the commit being certified';
    const bound = record?.binding?.commit ?? null;
    if (!input.requireCommitBinding && !input.expectedCommit) {
      checks.push(fail(id, name, 'no commit supplied and binding not required - cannot certify (run inside CI with GITHUB_SHA)'));
    } else if (!input.expectedCommit) {
      checks.push(fail(id, name, 'commit binding is required but no expected commit was supplied'));
    } else if (!isCommitSha(input.expectedCommit)) {
      checks.push(fail(id, name, `expected commit is not a 40-hex SHA: ${String(input.expectedCommit)}`));
    } else if (bound !== input.expectedCommit) {
      checks.push(fail(id, name, `record is bound to ${String(bound)} but the commit being certified is ${input.expectedCommit}`, {
        recordCommit: bound,
        expectedCommit: input.expectedCommit,
      }));
    } else {
      checks.push(pass(id, name, `record.binding.commit === ${input.expectedCommit} (source ${record?.binding?.commitSource ?? 'unknown'})`, {
        commit: bound,
        commitSource: record?.binding?.commitSource ?? null,
      }));
    }
  }

  // ------------------------------------------------------ 6. capability-bound
  {
    const id = 'capability-bound';
    const name = 'Agent capability surface is bound to real packages';
    const agent = freshManifest.agentGenome;
    const missing = AGENT_GENOME_PACKAGES.filter((p) => !agent.packages.some((x) => x.name === p));
    const empty = agent.packages.filter((p) => p.exports.length === 0).map((p) => p.name);
    const capabilityEvals = freshManifest.systemGenome.evaluations.filter((l) => l.path.includes('capabilities/'));

    const problems: string[] = [];
    if (missing.length > 0) problems.push(`missing agent packages: ${missing.join(', ')}`);
    if (empty.length > 0) problems.push(`agent packages exporting nothing: ${empty.join(', ')}`);
    if (capabilityEvals.length === 0) problems.push('no capability evaluations found in the genome');

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | ')));
    } else {
      checks.push(pass(id, name, `${agent.packageCount}/${AGENT_GENOME_PACKAGES.length} agent packages present, all exporting symbols, ${capabilityEvals.length} capability evaluation file(s) bound`, {
        packageCount: agent.packageCount,
        expected: AGENT_GENOME_PACKAGES.length,
        totalExports: agent.packages.reduce((n, p) => n + p.exports.length, 0),
        capabilityEvals: capabilityEvals.length,
      }));
    }
  }

  // --------------------------------------------------------- 7. evidence-bound
  {
    const id = 'evidence-bound';
    const name = 'Evidence artifacts are bound to the certified commit';
    const evidencePaths = input.evidencePaths ?? [];
    if (!input.expectedCommit) {
      checks.push(fail(id, name, 'no expected commit - evidence binding cannot be evaluated'));
    } else if (evidencePaths.length === 0) {
      checks.push(fail(id, name, 'no evidence artifacts were supplied for binding validation'));
    } else {
      const mismatched: string[] = [];
      let checked = 0;
      for (const rel of evidencePaths) {
        const full = join(root, rel);
        const loaded = loadJson(full) as { data: { commit?: unknown } | null; error: string | null };
        if (loaded.error) {
          mismatched.push(`${rel}: ${loaded.error}`);
          continue;
        }
        checked += 1;
        const commit = loaded.data?.commit;
        if (commit !== input.expectedCommit) {
          mismatched.push(`${rel}: commit=${String(commit)} != ${input.expectedCommit}`);
        }
      }
      if (mismatched.length > 0) {
        checks.push(fail(id, name, `${mismatched.length}/${evidencePaths.length} evidence artifact(s) not bound to the certified commit: ${mismatched.slice(0, 6).join('; ')}`, {
          checked,
          mismatched: mismatched.length,
        }));
      } else {
        checks.push(pass(id, name, `all ${checked} evidence artifact(s) carry commit === ${input.expectedCommit}`, { checked }));
      }
    }
  }

  // ---------------------------------------------------------- 8. package-bound
  {
    const id = 'package-bound';
    const name = 'Every workspace package is represented in the genome';
    const sys = freshManifest.systemGenome;
    const declared = [...sys.packages, ...sys.apps, ...sys.services];
    const withoutPkgJson = declared.filter((p) => p.fileCount === 0).map((p) => p.dir);
    const identityPresent = declared.some((p) => p.name === '@agi-system/identity');
    const autonomyPresent = declared.some((p) => p.name === '@agi-system/autonomy');
    const providersPresent = declared.some((p) => p.name === '@agi-system/providers');

    const problems: string[] = [];
    if (!identityPresent) problems.push('@agi-system/identity absent from the genome');
    if (!autonomyPresent) problems.push('@agi-system/autonomy absent from the genome');
    if (!providersPresent) problems.push('@agi-system/providers absent from the genome');
    if (withoutPkgJson.length > 0) problems.push(`package dirs with no files: ${withoutPkgJson.join(', ')}`);

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | ')));
    } else {
      checks.push(pass(id, name, `${declared.length} workspace package(s) bound (${sys.packages.length} packages, ${sys.apps.length} apps, ${sys.services.length} services)`, {
        total: declared.length,
      }));
    }
  }

  // ------------------------------------------------------------ 9. policy-bound
  {
    const id = 'policy-bound';
    const name = 'Zero-spend policy is bound into the genome';
    const spend = readMaxSpendPolicy(root);
    const providers = detectProviders(root, scanLeaves(root));
    const required = ['ollama', 'nvidia', 'gemini', 'groq', 'huggingface'];
    const missing = required.filter((p) => !providers.includes(p));

    const problems: string[] = [];
    if (!spend.declared) problems.push('MAX_SPEND is not declared in .env.example');
    if (!spend.zeroCost) problems.push(`MAX_SPEND is ${String(spend.value)}, not 0`);
    if (missing.length > 0) problems.push(`provider adapters missing from the genome: ${missing.join(', ')}`);

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | '), { spend }));
    } else {
      checks.push(pass(id, name, `MAX_SPEND=0 declared in ${spend.source}; ${providers.length} provider adapters bound (${providers.join(', ')})`, {
        maxSpend: spend.value,
        providers,
      }));
    }
  }

  // ------------------------------------------------------------- 10. test-bound
  {
    const id = 'test-bound';
    const name = 'Test suites are bound into the genome';
    const tests = freshManifest.systemGenome.tests;
    const evaluations = freshManifest.systemGenome.evaluations;
    const unitTests = tests.filter((l) => l.path.startsWith('tests/unit/'));
    const identityTests = tests.filter((l) => l.path.includes('identity'));
    const autonomyTests = tests.filter((l) => l.path.includes('autonomy'));

    const problems: string[] = [];
    if (unitTests.length === 0) problems.push('no unit tests in the genome');
    if (identityTests.length === 0) problems.push('no identity tests in the genome - the gate would be untested');
    if (autonomyTests.length === 0) problems.push('no autonomy tests in the genome');
    if (evaluations.length === 0) problems.push('no evaluations in the genome');

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | ')));
    } else {
      checks.push(pass(id, name, `${tests.length} test file(s) and ${evaluations.length} evaluation file(s) bound, including ${identityTests.length} identity and ${autonomyTests.length} autonomy test file(s)`, {
        tests: tests.length,
        evaluations: evaluations.length,
      }));
    }
  }

  // ------------------------------------------------------------ 11. files-bound
  {
    const id = 'files-bound';
    const name = 'Declared files exist and the leaf count matches the tree';
    const missingRequired = REQUIRED_PATHS.filter((p) => !existsSync(join(root, p)));
    const leafSet = new Set(freshManifest.systemGenome.packages.flatMap((p) => [p.dir]));
    const leafCountMatches = manifest ? manifest.files.leafCount === freshManifest.files.leafCount : false;

    const problems: string[] = [];
    if (missingRequired.length > 0) problems.push(`missing required path(s): ${missingRequired.join(', ')}`);
    if (!manifest) problems.push(stored.error ?? 'no stored manifest to compare leaf counts against');
    else if (!leafCountMatches) {
      problems.push(`stored leafCount ${manifest.files.leafCount} != recomputed ${freshManifest.files.leafCount}`);
    }

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | '), { requiredPaths: REQUIRED_PATHS.length }));
    } else {
      checks.push(pass(id, name, `all ${REQUIRED_PATHS.length} required path(s) exist and leafCount ${freshManifest.files.leafCount} matches the stored manifest`, {
        leafCount: freshManifest.files.leafCount,
        requiredPaths: REQUIRED_PATHS.length,
        packageDirs: leafSet.size,
      }));
    }
  }

  // ----------------------------------------------------------- 12. parent-bound
  {
    const id = 'parent-bound';
    const name = 'Lineage parent linkage is correct';
    const entries = loadedLineage.lineage.entries;
    if (entries.length === 0) {
      checks.push(fail(id, name, 'lineage is empty - no parent linkage to verify'));
    } else {
      const broken: string[] = [];
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1];
        const cur = entries[i];
        if (!prev || !cur) continue;
        if (cur.parentFingerprint !== prev.fingerprint) {
          broken.push(`entry[${i}] parent ${String(cur.parentFingerprint).slice(0, 12)}... != entry[${i - 1}] fingerprint ${prev.fingerprint.slice(0, 12)}...`);
        }
      }
      const genesis = entries[0];
      if (genesis && genesis.parentFingerprint !== null) broken.push('genesis entry has a non-null parent');

      if (broken.length > 0) {
        checks.push(fail(id, name, broken.join('; ')));
      } else {
        checks.push(pass(id, name, `${entries.length} entr(ies) correctly linked; genesis parent is null`, { entries: entries.length }));
      }
    }
  }

  // ----------------------------------------------------------- 13. merkle-valid
  {
    const id = 'merkle-valid';
    const name = 'Merkle root recomputes and inclusion proofs verify';
    const scan = scanRepository({ root });
    const tree = buildMerkleTree(scan.leaves);
    const sorted = sortLeaves(scan.leaves);
    const sample = sorted.filter((_, i) => i % Math.max(1, Math.floor(sorted.length / 8)) === 0).slice(0, 8);
    const badProofs: string[] = [];
    for (const leaf of sample) {
      const proof = inclusionProof(scan.leaves, leaf.path);
      if (!proof || !proof.valid) badProofs.push(leaf.path);
    }

    const problems: string[] = [];
    if (!manifest) problems.push(stored.error ?? 'no stored manifest');
    else if (manifest.files.merkleRoot !== tree.root) {
      problems.push(`stored merkleRoot ${String(manifest.files.merkleRoot).slice(0, 12)}... != recomputed ${tree.root.slice(0, 12)}...`);
    }
    if (badProofs.length > 0) problems.push(`inclusion proof failed for: ${badProofs.join(', ')}`);
    if (tree.leafCount === 0) problems.push('Merkle tree is empty');

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | ')));
    } else {
      checks.push(pass(id, name, `merkleRoot ${tree.root} recomputes; ${sample.length}/${sample.length} sampled inclusion proofs verify; depth ${tree.depth}`, {
        merkleRoot: tree.root,
        leafCount: tree.leafCount,
        depth: tree.depth,
        proofsSampled: sample.length,
      }));
    }
  }

  // ------------------------------------------------- 14. fingerprint-recomputable
  {
    const id = 'fingerprint-recomputable';
    const name = 'Fingerprint recomputes identically from scratch';
    const again = generateGeneticIdentity({ root });
    const a = freshManifest.fingerprint;
    const b = again.record.manifest.fingerprint;
    const c = manifest?.fingerprint ?? null;

    if (a !== b) {
      checks.push(fail(id, name, `two independent regenerations disagree: ${a.slice(0, 12)}... vs ${b.slice(0, 12)}...`, { fp1: a, fp2: b }));
    } else if (c !== null && c !== a) {
      checks.push(fail(id, name, `stored fingerprint ${String(c).slice(0, 12)}... does not reproduce as ${a.slice(0, 12)}...`, { stored: c, recomputed: a }));
    } else {
      checks.push(pass(id, name, `FP1 === FP2 === ${a}`, { fp1: a, fp2: b, stored: c }));
    }
  }

  // ------------------------------------------------------ 15. core-genome-valid
  checks.push(domainGenomeCheck('core-genome-valid', 'Core Genome', freshManifest.coreGenome, CORE_GENOME_PACKAGES));

  // ----------------------------------------------------- 16. agent-genome-valid
  checks.push(domainGenomeCheck('agent-genome-valid', 'Agent Genome', freshManifest.agentGenome, AGENT_GENOME_PACKAGES));

  // ---------------------------------------------------- 17. system-genome-valid
  {
    const id = 'system-genome-valid';
    const name = 'System Genome digest recomputes and covers the repository';
    const sys = freshManifest.systemGenome;
    const recomputed = sha256Hex(canonicalJson(stripDigest(sys)));
    const problems: string[] = [];
    if (recomputed !== sys.digest) problems.push(`digest mismatch: stored ${sys.digest.slice(0, 12)}... != recomputed ${recomputed.slice(0, 12)}...`);
    if (sys.workflows.length === 0) problems.push('no CI workflows in the System Genome');
    if (sys.config.length === 0) problems.push('no root config files in the System Genome');
    if (sys.packages.length === 0) problems.push('no packages in the System Genome');

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | ')));
    } else {
      checks.push(pass(id, name, `System Genome digest ${sys.digest.slice(0, 16)}... recomputes; ${sys.packages.length} packages, ${sys.workflows.length} workflows, ${sys.config.length} config files, ${sys.tests.length} test files`, {
        digest: sys.digest,
        packages: sys.packages.length,
        workflows: sys.workflows.length,
      }));
    }
  }

  // ---------------------------------------------------------- 18. circular-free
  {
    const id = 'circular-free';
    const name = 'No commit -> fingerprint circular dependency';
    const material = manifest
      ? {
          schemaVersion: manifest.schemaVersion,
          systemGenome: manifest.systemGenome,
          coreGenome: manifest.coreGenome,
          agentGenome: manifest.agentGenome,
          runtimeGenome: manifest.runtimeGenome,
          files: manifest.files,
          exclusions: manifest.exclusions,
        }
      : null;

    const forbidden = material ? findForbiddenKeys(material) : ['$ (no manifest)'];

    // Regenerating with a different commit argument must not move the fingerprint.
    const withCommitA = generateGeneticIdentity({ root, commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
    const withCommitB = generateGeneticIdentity({ root, commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' });
    const commitIndependent = withCommitA.record.manifest.fingerprint === withCommitB.record.manifest.fingerprint;

    // Writing certification output must not move the fingerprint either.
    const certExcluded = decideExclusion('certification/identity/genetic-manifest.json').excluded;

    const problems: string[] = [];
    if (forbidden.length > 0 && material) {
      problems.push(`forbidden key(s) present in hashed material: ${forbidden.slice(0, 5).join(', ')}`);
    }
    if (!material) problems.push('no manifest to inspect');
    if (!commitIndependent) problems.push('fingerprint changed when the commit argument changed - circular dependency present');
    if (!certExcluded) problems.push('certification/ output is NOT excluded from the genome leaves - writing a record would change its own fingerprint');

    if (problems.length > 0) {
      checks.push(fail(id, name, problems.join(' | ')));
    } else {
      checks.push(pass(id, name, `hashed material contains none of [${FORBIDDEN_HASHED_KEYS.join(', ')}]; fingerprint is identical under two different commit arguments; certification/ is excluded from leaves`, {
        forbiddenKeysScanned: FORBIDDEN_HASHED_KEYS.length,
        commitIndependent,
        certExcluded,
        fingerprint: withCommitA.record.manifest.fingerprint,
      }));
    }
  }

  // ------------------------------------------------------------------- reporting
  const total = checks.length;
  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;

  return {
    gate: 'G16',
    name: 'Genetic Identity Gate',
    description:
      'Proves the system has a deterministic, reproducible genetic identity: canonical manifest, SHA-256, real Merkle root, System/Core/Agent/Runtime genomes, mission fingerprint, lineage and identity id - with no commit -> fingerprint circular dependency and no secret material.',
    checks,
    total,
    passed,
    failed,
    status: failed === 0 && total > 0 ? 'PASS' : 'FAIL',
    fingerprint: manifest?.fingerprint ?? freshManifest.fingerprint,
    identityId: manifest?.identityId ?? freshManifest.identityId,
    manifestHash: manifest?.manifestHash ?? freshManifest.manifestHash,
    merkleRoot: manifest?.files.merkleRoot ?? freshManifest.files.merkleRoot,
    leafCount: freshManifest.files.leafCount,
    secretRuleCount: secretRuleInventory().length,
  };
}

/** Leaves for the current tree (used where a fresh scan was not already available). */
function scanLeaves(root: string) {
  return scanRepository({ root }).leaves;
}

/** Remove the `digest` field so it can be recomputed independently. */
function stripDigest<T extends { digest: string }>(value: T): Omit<T, 'digest'> {
  const { digest: _digest, ...rest } = value;
  return rest;
}

/** Shared implementation for the core / agent domain genome checks. */
function domainGenomeCheck(
  id: string,
  label: string,
  genome: { digest: string; packageCount: number; packages: { name: string; fileCount: number }[]; missing: string[] },
  allowList: readonly string[],
): CheckResult {
  const name = `${label} digest recomputes and covers its allow-list`;
  // Recomputed with the identical recipe used to create it: canonical JSON of the
  // stored object minus `digest`. No hidden inputs.
  const recomputed = sha256Hex(canonicalJson(stripDigest(genome), { dropKeys: [] }));
  const missing = allowList.filter((p) => !genome.packages.some((x) => x.name === p));
  const empty = genome.packages.filter((p) => p.fileCount === 0).map((p) => p.name);

  const problems: string[] = [];
  if (recomputed !== genome.digest) {
    problems.push(`digest mismatch: stored ${genome.digest.slice(0, 12)}... != recomputed ${recomputed.slice(0, 12)}...`);
  }
  if (missing.length > 0) problems.push(`missing from ${label}: ${missing.join(', ')}`);
  if (empty.length > 0) problems.push(`${label} package(s) with no files: ${empty.join(', ')}`);
  if (genome.missing.length > 0) {
    problems.push(`${label} itself reports missing allow-list entries: ${genome.missing.join(', ')}`);
  }

  if (problems.length > 0) {
    return fail(id, name, problems.join(' | '), { allowList: allowList.length, present: genome.packageCount });
  }
  return pass(id, name, `${label} digest ${genome.digest.slice(0, 16)}... recomputes; ${genome.packageCount}/${allowList.length} allow-listed package(s) present`, {
    digest: genome.digest,
    present: genome.packageCount,
    allowList: allowList.length,
  });
}

export { sealManifest, exclusionPolicySnapshot };
