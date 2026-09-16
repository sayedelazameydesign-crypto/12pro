/**
 * Identity derivation and formatting.
 *
 * The identity id is a pure function of the fingerprint, so it is stable across
 * machines and runs. It is deliberately NOT a function of the commit: two commits
 * with identical system content share an identity, which is the point - the
 * identity describes the SYSTEM, the commit describes WHERE it was observed.
 */
import { domainSha256Hex, isSha256Hex } from './hashing.ts';
import { deriveIdentityId } from './fingerprint.ts';
import { HASH_DOMAIN } from './types.ts';

export interface ParsedIdentity {
  prefix: 'agi';
  /** First 16 hex chars of the fingerprint. */
  short: string;
  valid: boolean;
}

/** Parse an `agi-xxxxxxxxxxxxxxxx` identity id. */
export function parseIdentityId(identityId: string): ParsedIdentity {
  const match = /^agi-([0-9a-f]{16})$/.exec(identityId);
  return {
    prefix: 'agi',
    short: match?.[1] ?? '',
    valid: match !== null,
  };
}

/** True when the identity id is consistent with the fingerprint it claims. */
export function identityMatchesFingerprint(identityId: string, fingerprint: string): boolean {
  if (!isSha256Hex(fingerprint)) return false;
  return identityId === deriveIdentityId(fingerprint);
}

/**
 * A scoped sub-identity for one genome domain, so a subsystem can be quoted without
 * exposing the whole fingerprint. Deterministic and domain-separated.
 */
export function domainIdentityId(fingerprint: string, domain: string): string {
  const scoped = domainSha256Hex(HASH_DOMAIN.identityId, `${fingerprint}:${domain}`);
  return `agi-${domain}-${scoped.slice(0, 12)}`;
}

/** Short human-quotable form used in logs and reports. */
export function shortFingerprint(fingerprint: string, length = 12): string {
  return fingerprint.slice(0, length);
}

export { deriveIdentityId };
