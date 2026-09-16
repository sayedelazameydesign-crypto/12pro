/**
 * SHA-256 helpers with explicit domain separation.
 *
 * Every hash in the genome is prefixed with a domain tag so that a hash computed
 * for one purpose can never be replayed as a hash for another (e.g. a file-leaf
 * hash can never be mistaken for a Merkle node hash).
 */
import { createHash } from 'node:crypto';

import { HASH_DOMAIN } from './types.ts';

/** Raw SHA-256 hex of a UTF-8 string or byte buffer. */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Domain-separated SHA-256 hex. */
export function domainSha256Hex(domain: string, input: string | Uint8Array): string {
  const hash = createHash('sha256');
  hash.update(domain);
  hash.update('\u0000');
  hash.update(input);
  return hash.digest('hex');
}

/** Domain-separated hash of a file leaf: binds path AND content together. */
export function fileLeafHash(path: string, contentSha256: string): string {
  return domainSha256Hex(HASH_DOMAIN.fileLeaf, `${path}\u0000${contentSha256}`);
}

/** True for a 64-char lowercase hex string. */
export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** True for a 40-char lowercase hex git SHA. */
export function isCommitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

export { HASH_DOMAIN };
