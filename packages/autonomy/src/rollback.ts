/**
 * Rollback.
 *
 * Rollback is hash-verified: the state restored from a checkpoint is re-hashed and
 * compared with the hash recorded when the checkpoint was taken. A mismatch means
 * the checkpoint was corrupted or tampered with, and the rollback REFUSES rather
 * than restoring unknown state.
 */
import { hashState, type CheckpointStore } from './checkpoint.ts';
import type { Checkpoint, RollbackResult } from './types.ts';

export interface RollbackOptions {
  /** Explicit checkpoint to restore. Defaults to the store tip's parent. */
  checkpointId?: string;
  /** Refuse to roll back across more than this many checkpoints. Default 10. */
  maxDepth?: number;
}

/** Resolve which checkpoint a rollback should target. */
export function resolveRollbackTarget(
  store: CheckpointStore,
  options: RollbackOptions = {},
): { target: Checkpoint | null; depth: number; reason: string } {
  const list = store.list();
  if (list.length === 0) return { target: null, depth: 0, reason: 'no checkpoints recorded' };

  if (options.checkpointId) {
    const index = list.findIndex((c) => c.id === options.checkpointId);
    if (index === -1) {
      return { target: null, depth: 0, reason: `checkpoint ${options.checkpointId} not found` };
    }
    const target = list[index];
    return { target, depth: list.length - 1 - index, reason: 'explicit checkpoint id' };
  }

  if (list.length === 1) {
    return { target: null, depth: 0, reason: 'only a genesis checkpoint exists - nothing to roll back to' };
  }

  const target = list[list.length - 2];
  return { target, depth: 1, reason: 'parent of current tip' };
}

/** Perform a hash-verified rollback. */
export function rollback(
  store: CheckpointStore,
  options: RollbackOptions = {},
): RollbackResult & { state: Record<string, unknown> | null } {
  const maxDepth = options.maxDepth ?? 10;
  const { target, depth, reason } = resolveRollbackTarget(store, options);

  if (!target) {
    return {
      outcome: 'NO_CHECKPOINT',
      fromCheckpointId: null,
      restoredStateHash: null,
      detail: reason,
      state: null,
    };
  }

  if (depth > maxDepth) {
    return {
      outcome: 'FAILED',
      fromCheckpointId: target.id,
      restoredStateHash: null,
      detail: `rollback depth ${depth} exceeds maxDepth ${maxDepth} - refusing`,
      state: null,
    };
  }

  // Re-hash the stored state and compare to the recorded hash.
  const recomputed = hashState(target.state);
  if (recomputed !== target.stateHash) {
    return {
      outcome: 'HASH_MISMATCH',
      fromCheckpointId: target.id,
      restoredStateHash: recomputed,
      detail: `checkpoint ${target.id} recorded ${target.stateHash.slice(0, 12)}... but its state hashes to ${recomputed.slice(0, 12)}... - refusing to restore unknown state`,
      state: null,
    };
  }

  const chain = store.verifyChain();
  if (!chain.valid) {
    return {
      outcome: 'FAILED',
      fromCheckpointId: target.id,
      restoredStateHash: recomputed,
      detail: `checkpoint chain is not intact (${chain.problems.length} problem(s)); first: ${chain.problems[0]}`,
      state: null,
    };
  }

  return {
    outcome: 'RESTORED',
    fromCheckpointId: target.id,
    restoredStateHash: recomputed,
    detail: `restored checkpoint ${target.id} ("${target.label}") at depth ${depth}`,
    // Return a copy so the caller cannot mutate checkpoint history by reference.
    state: JSON.parse(JSON.stringify(target.state)) as Record<string, unknown>,
  };
}
