/**
 * @agi-system/identity
 *
 * Genetic Identity layer: deterministic canonical manifest, SHA-256, real Merkle
 * root, System/Core/Agent/Runtime genomes, mission fingerprint, lineage and
 * identity id.
 *
 * Design invariants enforced by this package:
 *   1. The fingerprint is a pure function of repository CONTENT. It never takes a
 *      commit SHA, a timestamp, or any `certification/**` file as input.
 *   2. Canonicalization structurally drops `generatedAt`, `timestamp`, `commit`
 *      and `durationMs` at every depth before hashing.
 *   3. Commit binding is validated separately, as metadata - never as hash input.
 *      This removes the commit -> fingerprint circular dependency.
 *   4. Secrets are excluded by path policy and detected by content rules; raw
 *      secret values are never written into any artifact.
 *
 * This package runs directly under Node >= 22.6 type-stripping, so it stays within
 * erasable-syntax-only TypeScript (no enums, no parameter properties).
 */

export * from './types.ts';
export * from './canonical.ts';
export * from './hashing.ts';
export * from './merkle.ts';
export * from './exclusions.ts';
export * from './scan.ts';
export * from './secrets.ts';
export * from './secret-allowlist.ts';
export * from './genome.ts';
export * from './fingerprint.ts';
export * from './lineage.ts';
export * from './identity.ts';
export * from './g16-checks.ts';

export const PACKAGE_NAME = '@agi-system/identity';
export const VERSION = '0.1.0';
