/**
 * Lineage: an append-only chain of genetic identities.
 *
 * Each entry links to the fingerprint of the entry before it, so the history of a
 * system's genome is tamper-evident: rewriting or dropping any link breaks the
 * chain verification.
 *
 * Lineage entries DO carry a commit SHA and a timestamp, but they live under
 * `certification/identity/**`, which is excluded from the genome leaves. The chain
 * is therefore metadata ABOUT fingerprints, never an input TO them.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { isSha256Hex } from './hashing.ts';
import type { GeneticManifest, Lineage, LineageEntry } from './types.ts';

export const LINEAGE_SCHEMA_VERSION = '1.0.0';

/** Create a lineage entry from a sealed manifest plus non-hashed binding metadata. */
export function createLineageEntry(input: {
  manifest: GeneticManifest;
  commit?: string | null;
  generatedAt?: string;
}): LineageEntry {
  return {
    fingerprint: input.manifest.fingerprint,
    parentFingerprint: null,
    identityId: input.manifest.identityId,
    commit: input.commit ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    leafCount: input.manifest.files.leafCount,
    merkleRoot: input.manifest.files.merkleRoot,
  };
}

export interface LoadResult {
  lineage: Lineage;
  existed: boolean;
  parseError: string | null;
}

/** Load a lineage file, tolerating absence and corruption without throwing. */
export function loadLineage(filePath: string): LoadResult {
  if (!existsSync(filePath)) {
    return {
      lineage: { schemaVersion: LINEAGE_SCHEMA_VERSION, entries: [] },
      existed: false,
      parseError: null,
    };
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<Lineage>;
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    return {
      lineage: {
        schemaVersion: raw.schemaVersion ?? LINEAGE_SCHEMA_VERSION,
        entries: entries.filter((e): e is LineageEntry => e !== null && typeof e === 'object'),
      },
      existed: true,
      parseError: null,
    };
  } catch (err) {
    return {
      lineage: { schemaVersion: LINEAGE_SCHEMA_VERSION, entries: [] },
      existed: true,
      parseError: (err as Error).message,
    };
  }
}

/** Append an entry, linking it to the current tip. Returns the new lineage. */
export function appendToLineage(lineage: Lineage, entry: LineageEntry): Lineage {
  const tip = lineage.entries.length > 0 ? lineage.entries[lineage.entries.length - 1] : null;
  const linked: LineageEntry = {
    ...entry,
    parentFingerprint: tip ? tip.fingerprint : null,
  };

  // Idempotent: re-running on an unchanged tree must not grow the chain forever.
  if (tip && tip.fingerprint === linked.fingerprint) {
    const refreshed = [...lineage.entries];
    refreshed[refreshed.length - 1] = { ...tip, commit: linked.commit ?? tip.commit };
    return { schemaVersion: lineage.schemaVersion, entries: refreshed };
  }

  return { schemaVersion: lineage.schemaVersion, entries: [...lineage.entries, linked] };
}

export interface LineageVerification {
  valid: boolean;
  entryCount: number;
  problems: string[];
  tip: LineageEntry | null;
}

/** Verify chain integrity: linkage, hash shape, and absence of cycles. */
export function verifyLineage(lineage: Lineage): LineageVerification {
  const problems: string[] = [];
  const entries = lineage.entries;

  if (entries.length === 0) {
    return { valid: false, entryCount: 0, problems: ['lineage is empty'], tip: null };
  }

  const seen = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) {
      problems.push(`entry[${i}] is missing`);
      continue;
    }
    if (!isSha256Hex(entry.fingerprint)) {
      problems.push(`entry[${i}] fingerprint is not 64-hex`);
    }
    if (seen.has(entry.fingerprint) && i !== entries.length - 1) {
      problems.push(`entry[${i}] fingerprint repeats - possible cycle`);
    }
    seen.add(entry.fingerprint);

    if (!isSha256Hex(entry.merkleRoot)) {
      problems.push(`entry[${i}] merkleRoot is not 64-hex`);
    }
    if (typeof entry.leafCount !== 'number' || entry.leafCount <= 0) {
      problems.push(`entry[${i}] leafCount is not a positive number`);
    }
    if (!entry.identityId || !entry.identityId.startsWith('agi-')) {
      problems.push(`entry[${i}] identityId malformed`);
    }

    if (i === 0) {
      if (entry.parentFingerprint !== null) {
        problems.push('genesis entry must have parentFingerprint === null');
      }
    } else {
      const prev = entries[i - 1];
      if (prev && entry.parentFingerprint !== prev.fingerprint) {
        problems.push(
          `entry[${i}] parent-bound broken: expected ${prev.fingerprint.slice(0, 12)}..., got ${String(entry.parentFingerprint).slice(0, 12)}...`,
        );
      }
    }
  }

  return {
    valid: problems.length === 0,
    entryCount: entries.length,
    problems,
    tip: entries[entries.length - 1] ?? null,
  };
}

/** Persist a lineage file, creating parent directories as needed. */
export function writeLineage(filePath: string, lineage: Lineage): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(lineage, null, 2)}\n`, 'utf-8');
}
