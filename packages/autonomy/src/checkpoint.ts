/**
 * Checkpoints: immutable, content-addressed snapshots.
 *
 * The checkpoint id is derived from the state hash plus the parent id, so the
 * checkpoint history is tamper-evident: altering a stored state changes its hash,
 * which changes its id, which breaks the link from every later checkpoint.
 */
import { createHash } from 'node:crypto';

import type { Checkpoint } from './types.ts';

/** Canonical serialization with sorted keys, so equal states hash equally. */
export function canonicalState(state: Record<string, unknown>): string {
  const sortValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) out[key] = sortValue(record[key]);
      return out;
    }
    return value;
  };
  return JSON.stringify(sortValue(state));
}

/** SHA-256 of the canonical state. */
export function hashState(state: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalState(state)).digest('hex');
}

/** Deterministic checkpoint id from state hash and parent linkage. */
export function checkpointId(stateHash: string, parentCheckpointId: string | null): string {
  return createHash('sha256')
    .update(`agi-checkpoint:v1:${stateHash}:${parentCheckpointId ?? 'genesis'}`)
    .digest('hex')
    .slice(0, 24);
}

export interface CheckpointStore {
  list(): Checkpoint[];
  tip(): Checkpoint | null;
  get(id: string): Checkpoint | null;
  take(state: Record<string, unknown>, label: string): Checkpoint;
  /** Verify every link and hash in the store. */
  verifyChain(): { valid: boolean; problems: string[] };
}

/** In-memory checkpoint store. Persistence is the caller's responsibility. */
export function createCheckpointStore(): CheckpointStore {
  const checkpoints: Checkpoint[] = [];

  return {
    list(): Checkpoint[] {
      return [...checkpoints];
    },

    tip(): Checkpoint | null {
      return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
    },

    get(id: string): Checkpoint | null {
      return checkpoints.find((c) => c.id === id) ?? null;
    },

    take(state: Record<string, unknown>, label: string): Checkpoint {
      const tip = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
      const stateHash = hashState(state);
      const checkpoint: Checkpoint = {
        id: checkpointId(stateHash, tip ? tip.id : null),
        stateHash,
        parentCheckpointId: tip ? tip.id : null,
        label,
        createdAt: new Date().toISOString(),
        // Deep-freeze intent: store a structural copy so later mutation of the
        // caller's object cannot rewrite history.
        state: JSON.parse(canonicalState(state)) as Record<string, unknown>,
      };
      checkpoints.push(checkpoint);
      return checkpoint;
    },

    verifyChain(): { valid: boolean; problems: string[] } {
      const problems: string[] = [];
      for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        if (!cp) {
          problems.push(`checkpoint[${i}] missing`);
          continue;
        }
        const recomputed = hashState(cp.state);
        if (recomputed !== cp.stateHash) {
          problems.push(`checkpoint[${i}] (${cp.id}) state hash mismatch - tampered or corrupted`);
        }
        const expectedParent = i === 0 ? null : checkpoints[i - 1]?.id ?? null;
        if (cp.parentCheckpointId !== expectedParent) {
          problems.push(`checkpoint[${i}] (${cp.id}) parent link broken`);
        }
        const expectedId = checkpointId(cp.stateHash, cp.parentCheckpointId);
        if (expectedId !== cp.id) {
          problems.push(`checkpoint[${i}] id does not match its content`);
        }
      }
      return { valid: problems.length === 0, problems };
    },
  };
}
