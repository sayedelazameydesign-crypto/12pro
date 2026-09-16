/**
 * @agi-system/identity - type definitions
 *
 * NOTE: this package is executed directly by Node (>=22.6) type-stripping, so it
 * MUST stay within "erasable syntax only":
 *   - no `enum`            -> use `as const` objects + union types
 *   - no parameter properties (`constructor(private x)`) -> assign explicitly
 *   - no `namespace` / `declare` merging
 * Type-only imports MUST use `import type`.
 */

/** Schema version of the genetic manifest. Bump on any change to hashed material. */
export const GENOME_SCHEMA_VERSION = '1.0.0';

/** Domain separation tags. Prevents cross-context hash reuse collisions. */
export const HASH_DOMAIN = {
  fileLeaf: 'agi-genome:v1:file-leaf',
  merkleLeaf: 'agi-genome:v1:merkle-leaf',
  merkleNode: 'agi-genome:v1:merkle-node',
  merkleEmpty: 'agi-genome:v1:merkle-empty',
  fingerprint: 'agi-genome:v1:mission-fingerprint',
  identityId: 'agi-genome:v1:identity-id',
} as const;

export type HashDomain = (typeof HASH_DOMAIN)[keyof typeof HASH_DOMAIN];

/** A single file participating in the genome. */
export interface FileLeaf {
  /** Repository-relative POSIX path. */
  path: string;
  sizeBytes: number;
  /** SHA-256 of the raw file bytes, hex. */
  contentSha256: string;
}

/** Which genome domain a package belongs to. */
export type GenomeDomain = 'core' | 'agent' | 'runtime' | 'application' | 'service' | 'other';

/** A workspace package as seen by the genome. */
export interface PackageGenomeEntry {
  name: string;
  version: string;
  /** Repository-relative directory. */
  dir: string;
  domain: GenomeDomain;
  fileCount: number;
  /** SHA-256 over the canonical list of its source file leaves. */
  sourceDigest: string;
  /** Exported top-level symbols discovered in its sources. */
  exports: string[];
}

/** A CI workflow definition as seen by the genome. */
export interface WorkflowGenomeEntry {
  path: string;
  name: string;
  contentSha256: string;
  /** Job ids declared in the workflow. */
  jobs: string[];
  /** Node major version(s) the workflow requests. */
  nodeVersions: string[];
  /** True when any step can swallow a failure (`|| echo`, `continue-on-error`, `|| true`). */
  hasHiddenFailure: boolean;
}

/** Genome of a whole domain (core / agent / runtime / system). */
export interface DomainGenome {
  domain: string;
  packageCount: number;
  packages: PackageGenomeEntry[];
  /**
   * Allow-listed packages that were requested but NOT found. Recorded explicitly so
   * a silently absent package cannot make the genome look smaller - and therefore
   * "valid" - by accident.
   */
  missing: string[];
  /** SHA-256 over the canonical form of this object minus `digest` itself. */
  digest: string;
}

/** The complete System Genome: everything that defines the system. */
export interface SystemGenome {
  packages: PackageGenomeEntry[];
  apps: PackageGenomeEntry[];
  services: PackageGenomeEntry[];
  workflows: WorkflowGenomeEntry[];
  /** Root-level configuration/build files (package.json, tsconfig, vitest, eslint, docker...). */
  config: FileLeaf[];
  /** Root-level prose (README, LICENSE, CHANGELOG, SECURITY, CONTRIBUTING...). */
  rootDocs: FileLeaf[];
  /** JSON schemas under schemas/. */
  schemas: FileLeaf[];
  /** Test + evaluation suite inventory (paths only, plus digests). */
  tests: FileLeaf[];
  evaluations: FileLeaf[];
  benchmarks: FileLeaf[];
  /** Script inventory that produces or verifies certification. */
  scripts: FileLeaf[];
  digest: string;
}

/** The full deterministic manifest that gets hashed into the fingerprint. */
export interface GeneticManifest {
  schemaVersion: string;
  /**
   * Deliberately absent from hashed material:
   *   - generatedAt (wall clock, non-deterministic)
   *   - commit       (would create a commit -> fingerprint circular dependency)
   * `commit` lives ONLY in the non-hashed `binding` envelope.
   */
  systemGenome: SystemGenome;
  coreGenome: DomainGenome;
  agentGenome: DomainGenome;
  runtimeGenome: DomainGenome;
  files: {
    leafCount: number;
    totalBytes: number;
    /** Root of the real Merkle tree over all leaves. */
    merkleRoot: string;
    merkleDepth: number;
  };
  exclusions: {
    /**
     * POLICY ONLY - deterministic, and therefore safe to hash.
     * Counts of excluded files are deliberately NOT part of the hashed material:
     * they depend on whether `node_modules/`, `dist/` or coverage output happen to
     * exist in this working tree, which would leak machine state into the genome.
     * Those counts live in the non-hashed `binding.diagnostics` envelope instead.
     */
    pathPrefixes: string[];
    pathPatterns: string[];
  };
  /** SHA-256 of the canonical form of this manifest (excluding this field). */
  manifestHash: string;
  /** Mission fingerprint = sha256(domain || manifestHash). */
  fingerprint: string;
  /** Deterministic human-facing identity derived from the fingerprint. */
  identityId: string;
}

/**
 * Non-hashed envelope. This is the ONLY place a commit SHA is allowed to appear,
 * and it is validated as metadata - it is never an input to the fingerprint.
 */
export interface GeneticIdentityRecord {
  manifest: GeneticManifest;
  binding: {
    /** Commit the record was generated against. `null` when generated outside CI. */
    commit: string | null;
    /** Where the binding came from. */
    commitSource: 'GITHUB_SHA' | 'git-rev-parse' | 'argument' | 'unbound';
    generatedAt: string;
    generator: string;
    nodeVersion: string;
    /**
     * Non-hashed, machine-dependent scan statistics. Kept out of the fingerprint
     * on purpose: they describe the working tree, not the system definition.
     */
    diagnostics: {
      leafCount: number;
      totalBytes: number;
      excludedFileCount: number;
      prunedDirectoryCount: number;
      skippedCount: number;
      symlinkCount: number;
    };
  };
}

/** One link in the lineage chain. */
export interface LineageEntry {
  fingerprint: string;
  /** Fingerprint of the previous record, or null for genesis. */
  parentFingerprint: string | null;
  identityId: string;
  /** Metadata only - excluded from fingerprint input by construction. */
  commit: string | null;
  generatedAt: string;
  leafCount: number;
  merkleRoot: string;
}

export interface Lineage {
  schemaVersion: string;
  entries: LineageEntry[];
}

/** Result of a single named G16 check. */
export interface CheckResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
  /** Optional structured evidence for the check. */
  evidence?: Record<string, unknown>;
}
