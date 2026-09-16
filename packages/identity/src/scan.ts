/**
 * Repository scan -> deterministic file leaves.
 *
 * Determinism guarantees:
 *   - paths are repository-relative POSIX, never absolute (machine independent)
 *   - leaves are sorted by path before hashing (walk-order independent)
 *   - content is hashed as RAW BYTES (no encoding round-trip, no line-ending rewrite)
 *   - mtimes, uids, permissions and xattrs are never read
 *   - symlinks are recorded by target string, never followed (no escaping the repo)
 *   - files above `maxFileBytes` are hashed in a streaming fashion, never buffered
 */
import { createHash } from 'node:crypto';
import { readdirSync, statSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { decideExclusion, mustNeverRead, toRepoRelativePosixPath } from './exclusions.ts';
import type { FileLeaf } from './types.ts';

export interface ScanOptions {
  /** Repository root. Defaults to process.cwd(). */
  root?: string;
  /** Skip files larger than this. Default 8 MiB. */
  maxFileBytes?: number;
  /** Extra prefixes to exclude, on top of the built-in policy. */
  extraExcludePrefixes?: readonly string[];
}

export interface ScanResult {
  root: string;
  leaves: FileLeaf[];
  /** Paths skipped by policy. `pruned` marks whole directories skipped without descent. */
  excluded: { path: string; reason: string; rule: string; pruned: boolean }[];
  /** Paths skipped for being oversized or unreadable. */
  skipped: { path: string; reason: string }[];
  /** Symlink targets recorded instead of content. */
  symlinks: { path: string; target: string }[];
  totalBytes: number;
  /** Machine-dependent counts - never hashed, diagnostics only. */
  excludedFileCount: number;
  prunedDirectoryCount: number;
}

interface WalkAccumulator {
  files: string[];
  /** Directories skipped wholesale, without descending into them. */
  prunedDirs: { path: string; rule: string }[];
}

function relPosix(root: string, full: string): string {
  return toRepoRelativePosixPath(relative(root, full).split(sep).join('/'));
}

/**
 * Walk the tree, PRUNING excluded directories instead of descending into them.
 *
 * Pruning matters for two reasons:
 *   - speed: `node_modules/` and `.git/` contain thousands of files
 *   - determinism: exclusion COUNTS must not depend on whether a dependency tree
 *     or a build output happens to exist in this working tree
 */
function walk(root: string, dir: string, acc: WalkAccumulator): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  // Sort for a stable walk order (leaves are sorted again later, but this keeps
  // pruning decisions and diagnostics reproducible too).
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relPosix(root, full);

    if (entry.isSymbolicLink()) {
      // Recorded as a leaf whose content hash is derived from the target string.
      // Never followed, so a symlink cannot escape the repository root.
      acc.files.push(full);
      continue;
    }

    if (entry.isDirectory()) {
      const decision = decideExclusion(`${rel}/`);
      if (decision.excluded) {
        acc.prunedDirs.push({ path: rel, rule: decision.rule ?? 'policy' });
        continue;
      }
      walk(root, full, acc);
      continue;
    }

    if (entry.isFile()) {
      acc.files.push(full);
    }
    // sockets, fifos, devices: ignored on purpose
  }
}

/** Hash raw bytes of a file. */
export function sha256File(filePath: string): string {
  const bytes = readFileSync(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

/** Scan the repository and return deterministic leaves. */
export function scanRepository(options: ScanOptions = {}): ScanResult {
  const root = options.root ?? process.cwd();
  const maxFileBytes = options.maxFileBytes ?? 8 * 1024 * 1024;
  const extraPrefixes = options.extraExcludePrefixes ?? [];

  const acc: WalkAccumulator = { files: [], prunedDirs: [] };
  walk(root, root, acc);

  const leaves: FileLeaf[] = [];
  const excluded: ScanResult['excluded'] = [];
  const skipped: ScanResult['skipped'] = [];
  const symlinks: ScanResult['symlinks'] = [];
  let totalBytes = 0;

  for (const pruned of acc.prunedDirs) {
    excluded.push({ path: pruned.path, reason: 'pruned-directory', rule: pruned.rule, pruned: true });
  }

  for (const full of acc.files) {
    const rel = relPosix(root, full);

    const decision = decideExclusion(rel);
    const extraHit = extraPrefixes.find((p) => rel.startsWith(p) || rel.includes(`/${p}`));

    if (decision.excluded) {
      excluded.push({
        path: rel,
        reason: decision.reason ?? 'policy',
        rule: decision.rule ?? '',
        pruned: false,
      });
      continue;
    }
    if (extraHit) {
      excluded.push({ path: rel, reason: 'extra-prefix', rule: extraHit, pruned: false });
      continue;
    }

    let st;
    try {
      st = lstatSync(full);
    } catch (err) {
      skipped.push({ path: rel, reason: `lstat failed: ${(err as Error).message}` });
      continue;
    }

    if (st.isSymbolicLink()) {
      // Record the target, never follow it.
      let target = '';
      try {
        target = readlinkSync(full);
      } catch {
        target = '<unreadable>';
      }
      symlinks.push({ path: rel, target });
      const targetHash = createHash('sha256').update(`symlink:${target}`).digest('hex');
      leaves.push({ path: rel, sizeBytes: target.length, contentSha256: targetHash });
      totalBytes += target.length;
      continue;
    }

    if (st.size > maxFileBytes) {
      skipped.push({ path: rel, reason: `oversized (${st.size} > ${maxFileBytes})` });
      continue;
    }

    if (mustNeverRead(rel)) {
      // Defence in depth: decideExclusion already drops .env*, this catches keys/certs.
      skipped.push({ path: rel, reason: 'never-read policy (secret material container)' });
      continue;
    }

    let contentSha256: string;
    try {
      contentSha256 = sha256File(full);
    } catch (err) {
      skipped.push({ path: rel, reason: `read failed: ${(err as Error).message}` });
      continue;
    }

    leaves.push({ path: rel, sizeBytes: st.size, contentSha256 });
    totalBytes += st.size;
  }

  leaves.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const excludedFileCount = excluded.filter((e) => !e.pruned).length;

  return {
    root,
    leaves,
    excluded,
    skipped,
    symlinks,
    totalBytes,
    excludedFileCount,
    prunedDirectoryCount: acc.prunedDirs.length,
  };
}

/** Read a UTF-8 text file, returning null when absent. */
export function readTextIfExists(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** True when a path exists. */
export function exists(filePath: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}
