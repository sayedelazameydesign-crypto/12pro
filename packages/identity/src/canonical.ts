/**
 * Deterministic canonical serialization.
 *
 * Two structures that carry the same information MUST serialize byte-identically,
 * otherwise the fingerprint is not reproducible. Rules:
 *   - object keys sorted lexicographically by UTF-16 code unit at every depth
 *   - arrays keep their order (order is semantically meaningful)
 *   - `undefined` and non-enumerable/missing keys are dropped
 *   - `Date` is rejected (callers must pass ISO strings they control)
 *   - no whitespace, no trailing separators (plain JSON.stringify of the sorted shape)
 *
 * Fields listed in `dropKeys` are removed anywhere in the tree. This is how
 * non-deterministic material such as `generatedAt` is kept out of the hash input.
 */

export interface CanonicalOptions {
  /** Keys to strip at any depth before serializing. */
  dropKeys?: readonly string[];
}

const DEFAULT_DROP_KEYS: readonly string[] = ['generatedAt', 'timestamp', 'commit', 'durationMs'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Date) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively rebuild `value` with sorted object keys and dropped keys removed.
 * Throws on values that cannot be canonically represented.
 */
export function canonicalize(value: unknown, options: CanonicalOptions = {}, path = '$'): unknown {
  const dropKeys = options.dropKeys ?? DEFAULT_DROP_KEYS;

  if (value === null) return null;

  const t = typeof value;
  if (t === 'string' || t === 'boolean') return value;
  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) {
      throw new TypeError(`canonicalize: non-finite number at ${path}`);
    }
    // Normalize -0 to 0 so hashing is sign-stable.
    return n === 0 ? 0 : n;
  }
  if (t === 'undefined') return undefined;
  if (t === 'bigint') throw new TypeError(`canonicalize: bigint not supported at ${path}`);
  if (t === 'function' || t === 'symbol') {
    throw new TypeError(`canonicalize: ${t} not supported at ${path}`);
  }

  if (value instanceof Date) {
    throw new TypeError(
      `canonicalize: Date not supported at ${path} - pass an explicit ISO string instead`,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => canonicalize(item, options, `${path}[${i}]`));
  }

  if (!isPlainObject(value)) {
    throw new TypeError(
      `canonicalize: unsupported class instance at ${path} (${(value as object).constructor?.name})`,
    );
  }

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (dropKeys.includes(key)) continue;
    const child = canonicalize(record[key], options, `${path}.${key}`);
    if (child === undefined) continue;
    out[key] = child;
  }
  return out;
}

/** Canonical JSON string: sorted keys, no whitespace, non-deterministic keys dropped. */
export function canonicalJson(value: unknown, options: CanonicalOptions = {}): string {
  const canonical = canonicalize(value, options);
  if (canonical === undefined) return 'null';
  return JSON.stringify(canonical);
}

/**
 * Canonical JSON with an explicit, closed drop-list. Used for the genome so that
 * the exclusion of non-deterministic material is visible and auditable rather than
 * relying on a default.
 */
export function canonicalJsonWithDropped(
  value: unknown,
  dropKeys: readonly string[],
): { json: string; dropped: readonly string[] } {
  return { json: canonicalJson(value, { dropKeys }), dropped: dropKeys };
}
