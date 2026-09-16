/**
 * Real Merkle tree over the genome's file leaves.
 *
 * This is an actual hash tree, not a decorative digest:
 *   - leaves are domain-separated hashes binding (path, contentSha256)
 *   - leaves are sorted by path before tree construction, so tree shape depends
 *     only on the set of files, never on directory-walk order
 *   - internal nodes are sha256(domain || left || right)
 *   - an odd level duplicates the last node (Bitcoin-style), which keeps the tree
 *     fully binary and the root stable under a documented rule
 *   - the empty tree has its own domain-separated constant root
 *
 * `inclusionProof` produces a verifiable audit path, so a third party can confirm
 * that one specific file is (or is not) part of the committed genome without
 * re-hashing the whole repository.
 */
import { fileLeafHash, domainSha256Hex, sha256Hex } from './hashing.ts';
import { HASH_DOMAIN } from './types.ts';
import type { FileLeaf } from './types.ts';

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
}

export interface MerkleTree {
  root: string;
  leafCount: number;
  depth: number;
  levels: string[][];
}

export type ProofStepDirection = 'left' | 'right';

export interface MerkleInclusionProof {
  path: string;
  leafHash: string;
  root: string;
  steps: { sibling: string; direction: ProofStepDirection }[];
  valid: boolean;
}

/** Sort leaves deterministically by path (byte order via < on the string). */
export function sortLeaves(leaves: readonly FileLeaf[]): FileLeaf[] {
  return [...leaves].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Leaf hash for a file leaf. */
export function leafHashOf(leaf: FileLeaf): string {
  return fileLeafHash(leaf.path, leaf.contentSha256);
}

function nodeHash(left: string, right: string): string {
  return domainSha256Hex(HASH_DOMAIN.merkleNode, `${left}${right}`);
}

/** Build the full tree, returning every level for auditing. */
export function buildMerkleTree(leaves: readonly FileLeaf[]): MerkleTree {
  const sorted = sortLeaves(leaves);

  if (sorted.length === 0) {
    const root = domainSha256Hex(HASH_DOMAIN.merkleEmpty, 'no-files');
    return { root, leafCount: 0, depth: 0, levels: [[root]] };
  }

  let level = sorted.map(leafHashOf);
  const levels: string[][] = [level];

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      // Odd node out: duplicate the last hash (documented, deterministic rule).
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(nodeHash(left, right));
    }
    level = next;
    levels.push(level);
  }

  return {
    root: level[0],
    leafCount: sorted.length,
    depth: levels.length - 1,
    levels,
  };
}

/** Convenience: just the root hash. */
export function merkleRoot(leaves: readonly FileLeaf[]): string {
  return buildMerkleTree(leaves).root;
}

/** Produce an inclusion proof for one path, and self-verify it before returning. */
export function inclusionProof(
  leaves: readonly FileLeaf[],
  targetPath: string,
): MerkleInclusionProof | null {
  const sorted = sortLeaves(leaves);
  const index = sorted.findIndex((l) => l.path === targetPath);
  if (index === -1) return null;

  const leafHash = leafHashOf(sorted[index]);
  const tree = buildMerkleTree(sorted);
  const steps: { sibling: string; direction: ProofStepDirection }[] = [];

  let idx = index;
  for (let levelIndex = 0; levelIndex < tree.levels.length - 1; levelIndex++) {
    const level = tree.levels[levelIndex];
    const isRight = idx % 2 === 1;
    let siblingIdx = isRight ? idx - 1 : idx + 1;
    // Odd node out duplicates itself; the sibling is then its own hash.
    if (siblingIdx >= level.length) siblingIdx = idx;
    steps.push({
      sibling: level[siblingIdx],
      // `direction` = where the sibling sits relative to the running hash.
      direction: isRight ? 'left' : 'right',
    });
    idx = Math.floor(idx / 2);
  }

  const valid = verifyInclusionProof(leafHash, steps, tree.root);
  return { path: targetPath, leafHash, root: tree.root, steps, valid };
}

/** Recompute a root from a leaf hash plus proof steps. */
export function verifyInclusionProof(
  leafHash: string,
  steps: readonly { sibling: string; direction: ProofStepDirection }[],
  expectedRoot: string,
): boolean {
  let running = leafHash;
  for (const step of steps) {
    running =
      step.direction === 'left'
        ? nodeHash(step.sibling, running)
        : nodeHash(running, step.sibling);
  }
  return running === expectedRoot;
}

/**
 * Independent recomputation of the root straight from (path, contentSha256) pairs.
 * Used by the verifier so the root is never trusted from the manifest alone.
 */
export function recomputeRootFromDigests(entries: readonly { path: string; contentSha256: string }[]): string {
  return merkleRoot(
    entries.map((e) => ({ path: e.path, sizeBytes: 0, contentSha256: e.contentSha256 })),
  );
}

export { sha256Hex };
