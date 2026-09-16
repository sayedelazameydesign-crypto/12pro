import { describe, it, expect } from 'vitest';
import { canonicalJson, canonicalize } from '@agi-system/identity';

describe('identity / canonical serialization', () => {
  it('produces identical bytes regardless of key insertion order', () => {
    const a = { z: 1, m: { b: 2, a: 1 }, y: [3, 2, 1] };
    const b = { y: [3, 2, 1], m: { a: 1, b: 2 }, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('preserves array order because order is semantically meaningful', () => {
    expect(canonicalJson({ v: [1, 2, 3] })).not.toBe(canonicalJson({ v: [3, 2, 1] }));
  });

  it('drops generatedAt, timestamp, commit and durationMs at every depth by default', () => {
    const value = {
      generatedAt: '2026-01-01T00:00:00Z',
      keep: 1,
      nested: { timestamp: 'x', commit: 'abc', durationMs: 5, keep: 2 },
      deep: [{ generatedAt: 'y', keep: 3 }],
    };
    const json = canonicalJson(value);
    expect(json).not.toContain('generatedAt');
    expect(json).not.toContain('timestamp');
    expect(json).not.toContain('commit');
    expect(json).not.toContain('durationMs');
    expect(json).toContain('"keep":1');
    expect(json).toContain('"keep":2');
    expect(json).toContain('"keep":3');
  });

  it('can be told to keep every key when an explicit empty drop-list is given', () => {
    const value = { commit: 'abc', keep: 1 };
    expect(canonicalJson(value, { dropKeys: [] })).toContain('commit');
  });

  it('rejects Date instances instead of silently stringifying them', () => {
    expect(() => canonicalize({ at: new Date() })).toThrow(/Date not supported/);
  });

  it('rejects non-finite numbers, which have no stable JSON form', () => {
    expect(() => canonicalize({ n: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalize({ n: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
  });

  it('normalizes -0 to 0 so hashing is sign-stable', () => {
    expect(canonicalJson({ n: -0 })).toBe(canonicalJson({ n: 0 }));
  });

  it('drops undefined values rather than emitting null', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('rejects class instances, whose JSON shape is not part of the contract', () => {
    class Thing {
      x = 1;
    }
    expect(() => canonicalize({ t: new Thing() })).toThrow(/unsupported class instance/);
  });
});
