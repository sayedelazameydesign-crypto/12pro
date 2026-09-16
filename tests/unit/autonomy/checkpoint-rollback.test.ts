import { describe, it, expect } from 'vitest';
import {
  createCheckpointStore,
  hashState,
  canonicalState,
  checkpointId,
  rollback,
  resolveRollbackTarget,
} from '@agi-system/autonomy';

describe('autonomy / checkpoints', () => {
  it('hashes equal states equally regardless of key order', () => {
    expect(hashState({ a: 1, b: 2 })).toBe(hashState({ b: 2, a: 1 }));
    expect(canonicalState({ a: 1, b: { c: 2, d: 3 } })).toBe(canonicalState({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('hashes different states differently', () => {
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 2 }));
  });

  it('derives a deterministic checkpoint id from content and parent', () => {
    const h = hashState({ a: 1 });
    expect(checkpointId(h, null)).toBe(checkpointId(h, null));
    expect(checkpointId(h, null)).not.toBe(checkpointId(h, 'parent'));
  });

  it('links checkpoints into a chain whose genesis parent is null', () => {
    const store = createCheckpointStore();
    const first = store.take({ step: 1 }, 'first');
    const second = store.take({ step: 2 }, 'second');

    expect(first.parentCheckpointId).toBeNull();
    expect(second.parentCheckpointId).toBe(first.id);
    expect(store.tip()?.id).toBe(second.id);
    expect(store.list().length).toBe(2);
  });

  it('verifies an untampered chain', () => {
    const store = createCheckpointStore();
    store.take({ step: 1 }, 'a');
    store.take({ step: 2 }, 'b');
    expect(store.verifyChain().valid).toBe(true);
  });

  it('detects tampering with a stored checkpoint state', () => {
    const store = createCheckpointStore();
    store.take({ step: 1 }, 'a');
    const cp = store.take({ step: 2 }, 'b');

    // Mutate the stored state behind the store's back.
    cp.state.step = 999;

    const result = store.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.problems.join(' ')).toMatch(/hash mismatch|parent link|does not match its content/);
  });

  it('stores a structural copy so caller mutation cannot rewrite history', () => {
    const store = createCheckpointStore();
    const state = { nested: { value: 1 } };
    const cp = store.take(state, 'snapshot');

    state.nested.value = 42;

    expect((cp.state.nested as { value: number }).value).toBe(1);
    expect(store.verifyChain().valid).toBe(true);
  });
});

describe('autonomy / rollback', () => {
  it('refuses when no checkpoint exists', () => {
    const store = createCheckpointStore();
    const result = rollback(store);
    expect(result.outcome).toBe('NO_CHECKPOINT');
    expect(result.state).toBeNull();
  });

  it('refuses when only a genesis checkpoint exists', () => {
    const store = createCheckpointStore();
    store.take({ step: 1 }, 'only');
    const result = rollback(store);
    expect(result.outcome).toBe('NO_CHECKPOINT');
    expect(result.detail).toContain('nothing to roll back to');
  });

  it('restores the parent of the tip and returns a copy of its state', () => {
    const store = createCheckpointStore();
    store.take({ step: 1 }, 'good');
    store.take({ step: 2 }, 'bad');

    const result = rollback(store);
    expect(result.outcome).toBe('RESTORED');
    expect(result.state).toEqual({ step: 1 });
    expect(result.restoredStateHash).toBe(hashState({ step: 1 }));

    // The returned state must be a copy, not the checkpoint's own object.
    (result.state as { step: number }).step = 99;
    expect(store.list()[0]?.state.step).toBe(1);
  });

  it('REFUSES to restore a checkpoint whose hash no longer matches', () => {
    const store = createCheckpointStore();
    const good = store.take({ step: 1 }, 'good');
    store.take({ step: 2 }, 'bad');

    good.state.step = 12345; // corrupt the checkpoint

    const result = rollback(store, { checkpointId: good.id });
    expect(result.outcome).not.toBe('RESTORED');
    expect(result.state).toBeNull();
    expect(result.detail).toMatch(/refus|corrupt|not intact/i);
  });

  it('honours an explicit target checkpoint id', () => {
    const store = createCheckpointStore();
    const a = store.take({ step: 1 }, 'a');
    store.take({ step: 2 }, 'b');
    store.take({ step: 3 }, 'c');

    const result = rollback(store, { checkpointId: a.id });
    expect(result.outcome).toBe('RESTORED');
    expect(result.state).toEqual({ step: 1 });
  });

  it('reports a missing explicit target rather than silently rolling back further', () => {
    const store = createCheckpointStore();
    store.take({ step: 1 }, 'a');
    store.take({ step: 2 }, 'b');
    const result = rollback(store, { checkpointId: 'nonexistent' });
    expect(result.outcome).toBe('NO_CHECKPOINT');
    expect(result.detail).toContain('not found');
  });

  it('refuses to roll back deeper than maxDepth', () => {
    const store = createCheckpointStore();
    const a = store.take({ step: 0 }, 'a');
    for (let i = 1; i <= 5; i++) store.take({ step: i }, `cp${i}`);

    const result = rollback(store, { checkpointId: a.id, maxDepth: 2 });
    expect(result.outcome).toBe('FAILED');
    expect(result.detail).toMatch(/exceeds maxDepth/);
  });

  it('resolves the rollback target with a stated reason', () => {
    const store = createCheckpointStore();
    store.take({ step: 1 }, 'a');
    store.take({ step: 2 }, 'b');
    const resolved = resolveRollbackTarget(store);
    expect(resolved.target?.id).toBe(store.list()[0]?.id);
    expect(resolved.depth).toBe(1);
    expect(resolved.reason.length).toBeGreaterThan(0);
  });
});
