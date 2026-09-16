/**
 * Mission fingerprint.
 *
 *   manifestHash = SHA-256( canonicalJson( genome material ) )
 *   fingerprint  = SHA-256( "agi-genome:v1:mission-fingerprint" || 0x00 || manifestHash )
 *   identityId   = "agi-" + fingerprint[0..16]
 *
 * The canonicalizer is invoked with its DEFAULT drop-list, which removes
 * `generatedAt`, `timestamp`, `commit` and `durationMs` at every depth. That makes
 * the exclusion of non-deterministic and commit-derived material structural: even
 * if a future field accidentally carries a wall-clock time or a SHA, it cannot enter
 * the hash. This is the mechanism that guarantees there is no
 * `commit -> fingerprint` circular dependency.
 */
import { canonicalJson } from './canonical.ts';
import { domainSha256Hex, sha256Hex, isSha256Hex } from './hashing.ts';
import { buildMerkleTree } from './merkle.ts';
import { exclusionPolicySnapshot } from './exclusions.ts';
import { scanRepository } from './scan.ts';
import {
  buildSystemGenome,
  buildDomainGenome,
  buildGeneticManifest,
  CORE_GENOME_PACKAGES,
  AGENT_GENOME_PACKAGES,
  RUNTIME_GENOME_PACKAGES,
} from './genome.ts';
import { GENOME_SCHEMA_VERSION, HASH_DOMAIN } from './types.ts';
import type { GeneticIdentityRecord, GeneticManifest } from './types.ts';

/** Shape of the manifest before its own hashes are known. */
export type ManifestMaterial = Omit<GeneticManifest, 'manifestHash' | 'fingerprint' | 'identityId'>;

/** SHA-256 over the canonical genome material. */
export function computeManifestHash(material: ManifestMaterial): string {
  // Default drop-list applies: generatedAt / timestamp / commit / durationMs are
  // stripped at every depth before hashing.
  return sha256Hex(canonicalJson(material));
}

/** Domain-separated mission fingerprint derived from the manifest hash. */
export function computeFingerprint(manifestHash: string): string {
  return domainSha256Hex(HASH_DOMAIN.fingerprint, manifestHash);
}

/** Deterministic, human-quotable identity id. */
export function deriveIdentityId(fingerprint: string): string {
  if (!isSha256Hex(fingerprint)) {
    throw new TypeError(`deriveIdentityId: fingerprint must be 64-hex, got ${String(fingerprint)}`);
  }
  return `agi-${fingerprint.slice(0, 16)}`;
}

/** Complete a manifest material into a full manifest with its hashes filled in. */
export function sealManifest(material: ManifestMaterial): GeneticManifest {
  const manifestHash = computeManifestHash(material);
  const fingerprint = computeFingerprint(manifestHash);
  return { ...material, manifestHash, fingerprint, identityId: deriveIdentityId(fingerprint) };
}

export interface GenerateOptions {
  /** Repository root. Defaults to process.cwd(). */
  root?: string;
  /** Commit to record in the non-hashed binding envelope. Never hashed. */
  commit?: string | null;
  /** Where the commit value came from. */
  commitSource?: GeneticIdentityRecord['binding']['commitSource'];
  /** Generator label recorded in the binding envelope. */
  generator?: string;
}

export interface GenerateResult {
  record: GeneticIdentityRecord;
  /** Number of files hashed into the genome. */
  leafCount: number;
  /** Files skipped by exclusion policy. */
  excludedCount: number;
}

/**
 * Full pipeline: scan -> genomes -> Merkle -> manifest -> fingerprint -> identity.
 *
 * Called twice by the verifier to prove FP1 === FP2.
 */
export function generateGeneticIdentity(options: GenerateOptions = {}): GenerateResult {
  const root = options.root ?? process.cwd();

  const scan = scanRepository({ root });
  const systemGenome = buildSystemGenome({ root, leaves: scan.leaves });
  const coreGenome = buildDomainGenome('core', CORE_GENOME_PACKAGES, systemGenome);
  const agentGenome = buildDomainGenome('agent', AGENT_GENOME_PACKAGES, systemGenome);
  const runtimeGenome = buildDomainGenome('runtime', RUNTIME_GENOME_PACKAGES, systemGenome);

  const tree = buildMerkleTree(scan.leaves);
  const policy = exclusionPolicySnapshot();

  const material = buildGeneticManifest({
    systemGenome,
    coreGenome,
    agentGenome,
    runtimeGenome,
    leaves: scan.leaves,
    totalBytes: scan.totalBytes,
    merkleRoot: tree.root,
    merkleDepth: tree.depth,
    pathPrefixes: policy.pathPrefixes,
    pathPatterns: policy.pathPatterns,
  });

  const manifest = sealManifest(material);

  const record: GeneticIdentityRecord = {
    manifest,
    binding: {
      commit: options.commit ?? null,
      commitSource: options.commitSource ?? 'unbound',
      generatedAt: new Date().toISOString(),
      generator: options.generator ?? '@agi-system/identity',
      nodeVersion: process.version,
      diagnostics: {
        leafCount: scan.leaves.length,
        totalBytes: scan.totalBytes,
        excludedFileCount: scan.excludedFileCount,
        prunedDirectoryCount: scan.prunedDirectoryCount,
        skippedCount: scan.skipped.length,
        symlinkCount: scan.symlinks.length,
      },
    },
  };

  return { record, leafCount: scan.leaves.length, excludedCount: scan.excludedFileCount };
}

/**
 * Prove the fingerprint does not depend on the binding envelope.
 *
 * Re-seals the SAME material with two different commits/timestamps and asserts the
 * fingerprint is identical. This is the executable form of the "no commit ->
 * fingerprint circular dependency" requirement.
 */
export function assertFingerprintIgnoresBinding(record: GeneticIdentityRecord): {
  stable: boolean;
  fingerprintA: string;
  fingerprintB: string;
} {
  const material: ManifestMaterial = {
    schemaVersion: record.manifest.schemaVersion,
    systemGenome: record.manifest.systemGenome,
    coreGenome: record.manifest.coreGenome,
    agentGenome: record.manifest.agentGenome,
    runtimeGenome: record.manifest.runtimeGenome,
    files: record.manifest.files,
    exclusions: record.manifest.exclusions,
  };

  const a = sealManifest(material);

  // Perturb the binding envelope in every way that could leak into the hash.
  const perturbed: GeneticIdentityRecord = {
    manifest: { ...a, schemaVersion: a.schemaVersion },
    binding: {
      commit: 'ffffffffffffffffffffffffffffffffffffffff',
      commitSource: 'argument',
      generatedAt: new Date(Date.now() + 86_400_000).toISOString(),
      generator: 'perturbed-generator',
      nodeVersion: 'v0.0.0',
      diagnostics: {
        leafCount: 999_999,
        totalBytes: 999_999,
        excludedFileCount: 999_999,
        prunedDirectoryCount: 999_999,
        skippedCount: 999_999,
        symlinkCount: 999_999,
      },
    },
  };
  const b = sealManifest({
    schemaVersion: perturbed.manifest.schemaVersion,
    systemGenome: perturbed.manifest.systemGenome,
    coreGenome: perturbed.manifest.coreGenome,
    agentGenome: perturbed.manifest.agentGenome,
    runtimeGenome: perturbed.manifest.runtimeGenome,
    files: perturbed.manifest.files,
    exclusions: perturbed.manifest.exclusions,
  });

  return { stable: a.fingerprint === b.fingerprint, fingerprintA: a.fingerprint, fingerprintB: b.fingerprint };
}

export { GENOME_SCHEMA_VERSION, HASH_DOMAIN };
