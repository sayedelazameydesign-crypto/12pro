import { describe, it, expect } from 'vitest';
import {
  buildMerkleTree,
  merkleRoot,
  inclusionProof,
  verifyInclusionProof,
  sortLeaves,
  recomputeRootFromDigests,
} from '@agi-system/identity';
import type { FileLeaf } from '@agi-system/identity';

function leaf(path: string, content: string): FileLeaf {
  // Deterministic stand-in for a real content hash.
  let h = 0;
  for (let i = 0; i < content.length; i++) h = (h * 31 + content.charCodeAt(i)) >>> 0;
  return { path, sizeBytes: content.length, contentSha256: h.toString(16).padStart(64, '0') };
}

describe('identity / merkle tree', () => {
  const leaves = [leaf('a.ts', 'a'), leaf('b.ts', 'b'), leaf('c.ts', 'c'), leaf('d.ts', 'd')];

  it('produces a 64-hex root', () => {
    expect(merkleRoot(leaves)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is independent of the input order', () => {
    const shuffled = [leaves[2], leaves[0], leaves[3], leaves[1]];
    expect(merkleRoot(shuffled)).toBe(merkleRoot(leaves));
  });

  it('changes when any single leaf content changes', () => {
    const modified = [...leaves];
    modified[1] = leaf('b.ts', 'B');
    expect(merkleRoot(modified)).not.toBe(merkleRoot(leaves));
  });

  it('changes when a leaf path changes even if content is identical', () => {
    const renamed = [...leaves];
    renamed[1] = leaf('b-renamed.ts', 'b');
    expect(merkleRoot(renamed)).not.toBe(merkleRoot(leaves));
  });

  it('handles an odd number of leaves deterministically', () => {
    const odd = [leaf('a.ts', 'a'), leaf('b.ts', 'b'), leaf('c.ts', 'c')];
    const first = merkleRoot(odd);
    const second = merkleRoot([...odd].reverse());
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('has a stable, non-empty root for the empty tree', () => {
    const empty = buildMerkleTree([]);
    expect(empty.leafCount).toBe(0);
    expect(empty.depth).toBe(0);
    expect(empty.root).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a depth consistent with the leaf count', () => {
    const tree = buildMerkleTree(leaves);
    expect(tree.leafCount).toBe(4);
    expect(tree.depth).toBe(2);
    expect(tree.levels.map((l) => l.length)).toEqual([4, 2, 1]);
  });

  it('verifies an inclusion proof for every leaf', () => {
    for (const l of leaves) {
      const proof = inclusionProof(leaves, l.path);
      expect(proof, `proof for ${l.path}`).not.toBeNull();
      expect(proof?.valid).toBe(true);
      expect(proof?.root).toBe(merkleRoot(leaves));
    }
  });

  it('verifies inclusion proofs for an odd-sized tree too', () => {
    const odd = [leaf('a.ts', 'a'), leaf('b.ts', 'b'), leaf('c.ts', 'c'), leaf('d.ts', 'd'), leaf('e.ts', 'e')];
    for (const l of odd) {
      const proof = inclusionProof(odd, l.path);
      expect(proof?.valid, `odd-tree proof for ${l.path}`).toBe(true);
    }
  });

  it('returns null for a path that is not in the tree', () => {
    expect(inclusionProof(leaves, 'missing.ts')).toBeNull();
  });

  it('rejects a proof whose root was tampered with', () => {
    const proof = inclusionProof(leaves, 'b.ts');
    expect(proof).not.toBeNull();
    const tamperedRoot = 'f'.repeat(64);
    expect(verifyInclusionProof(proof!.leafHash, proof!.steps, tamperedRoot)).toBe(false);
  });

  it('rejects a proof built from a different leaf hash', () => {
    const proof = inclusionProof(leaves, 'b.ts');
    const other = inclusionProof(leaves, 'c.ts');
    expect(verifyInclusionProof(other!.leafHash, proof!.steps, proof!.root)).toBe(false);
  });

  it('recomputes the same root from bare (path, digest) pairs', () => {
    const fromDigests = recomputeRootFromDigests(
      leaves.map((l) => ({ path: l.path, contentSha256: l.contentSha256 })),
    );
    expect(fromDigests).toBe(merkleRoot(leaves));
  });

  it('sorts leaves by path', () => {
    const sorted = sortLeaves([leaves[3], leaves[1], leaves[2], leaves[0]]);
    expect(sorted.map((l) => l.path)).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
  });
});
