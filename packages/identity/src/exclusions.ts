/**
 * Genome exclusion policy.
 *
 * Two distinct reasons a path is excluded, and they must not be conflated:
 *
 * 1. NON-DETERMINISTIC / GENERATED  - build outputs, dependency trees, coverage,
 *    test-run scratch. Including these would make the fingerprint depend on
 *    whether someone happened to run `npm ci` or a build first.
 *
 * 2. CIRCULARITY                    - certification OUTPUT. These files contain
 *    the commit SHA and the fingerprint itself. If they were genome INPUT then
 *    writing the record would change the record's own fingerprint, which is the
 *    exact `commit -> fingerprint` circular dependency this design forbids.
 *    Therefore the whole `certification/` subtree is measurement, never genome.
 *
 * 3. SECRET MATERIAL                - any `.env*` file is excluded from the leaves
 *    regardless of whether it looks safe. Policy checks may still READ
 *    `.env.example` (e.g. to assert MAX_SPEND=0); reading is not fingerprinting.
 */

/** Excluded when the relative path starts with one of these prefixes. */
export const EXCLUDED_PATH_PREFIXES: readonly string[] = [
  // generated / non-deterministic
  '.git/',
  'node_modules/',
  'dist/',
  'build/',
  'out/',
  'coverage/',
  '.turbo/',
  '.next/',
  '.nuxt/',
  '.output/',
  '.cache/',
  '.tmp/',
  'tmp/',
  'temp/',
  'playwright-report/',
  'test-results/',
  '.nyc_output/',
  '.docker/',
  '.vite/',
  '.arena/',
  // circularity: certification output is measurement, not genome input
  'certification/',
  // Scratch created by .github/workflows/certification.yml. These are not hidden, so
  // the dot-directory rule above does not catch them, and they must not enter the
  // genome: the verify-remote-binding job downloads artifacts into
  // certification-from-ci/ and compares them, which would otherwise change the very
  // fingerprint it is checking.
  'certification-from-ci/',
  'fingerprint-reproducibility/',
];

/** Excluded when the basename or full path matches one of these patterns. */
export const EXCLUDED_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.env(\.[^/]*)?$/, // every .env variant, including .env.example
  /(^|\/)[^/]*\.tsbuildinfo$/,
  /(^|\/)[^/]*\.log$/,
  /(^|\/)\.DS_Store$/,
  /(^|\/)Thumbs\.db$/,
  /(^|\/)[^/]*\.swp$/,
  /(^|\/)[^/]*\.swo$/,
];

/** Files that must never be scanned for content at all. */
export const NEVER_READ_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.env(\.[^/]*)?$/,
  /(^|\/)id_rsa$/,
  /(^|\/)id_ed25519$/,
  /\.pem$/,
  /\.p12$/,
  /\.pfx$/,
  /\.keystore$/,
];

export interface ExclusionDecision {
  excluded: boolean;
  reason: 'path-prefix' | 'path-pattern' | 'hidden-directory' | null;
  rule: string | null;
}

/**
 * Dot-directories that ARE source rather than tooling scratch.
 *
 * `.github` holds the workflows, which are part of the System Genome and must be
 * hashed. Everything else beginning with a dot is treated as transient.
 */
export const HIDDEN_DIRECTORY_ALLOWLIST: readonly string[] = ['.github'];

/** Normalize a path to repository-relative POSIX form. */
export function toRepoRelativePosixPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/** Decide whether a repository-relative POSIX path participates in the genome. */
export function decideExclusion(relativePath: string): ExclusionDecision {
  const path = toRepoRelativePosixPath(relativePath);

  /**
   * Hidden DIRECTORIES are tooling scratch unless explicitly allow-listed.
   *
   * The prefix list above is enumerated, so any directory nobody thought to name
   * entered the genome. That made the fingerprint depend on whatever a build, a test
   * runner or a verification script happened to leave in the working tree: creating
   * `.fingerprint-out/` and recomputing produced a DIFFERENT fingerprint, so the
   * reproducibility check compared two different trees and could fail for a reason
   * that had nothing to do with determinism.
   *
   * Only DIRECTORY segments are judged, so a file inside a hidden directory is
   * excluded by virtue of its parent while dot-FILES such as `.gitignore`,
   * `.eslintrc.json` and `.prettierrc` remain leaves - they are source, not scratch.
   * Judging directory segments rather than only paths ending in `/` matters: the walk
   * prunes hidden directories, but a caller that asks about a file path directly must
   * get the same answer the walk would have produced.
   */
  const segments = path.split('/').filter((segment) => segment.length > 0);
  // A trailing slash means the subject IS a directory, so every segment is one.
  // Otherwise the last segment is the file itself and must not be judged as a
  // directory: `.gitignore` is configuration, not scratch.
  const directorySegments = path.endsWith('/') ? segments : segments.slice(0, -1);
  for (const segment of directorySegments) {
    if (segment.startsWith('.') && !HIDDEN_DIRECTORY_ALLOWLIST.includes(segment)) {
      return { excluded: true, reason: 'hidden-directory', rule: segment };
    }
  }

  for (const prefix of EXCLUDED_PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return { excluded: true, reason: 'path-prefix', rule: prefix };
    }
    // Also match a nested occurrence of directory-style prefixes (e.g. `a/dist/b`).
    if (prefix.endsWith('/') && path.includes(`/${prefix}`)) {
      return { excluded: true, reason: 'path-prefix', rule: `*/${prefix}` };
    }
  }

  for (const pattern of EXCLUDED_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return { excluded: true, reason: 'path-pattern', rule: pattern.source };
    }
  }

  return { excluded: false, reason: null, rule: null };
}

/** True when the file content must never be read into the genome. */
export function mustNeverRead(relativePath: string): boolean {
  const path = toRepoRelativePosixPath(relativePath);
  return NEVER_READ_PATTERNS.some((p) => p.test(path));
}

/**
 * Serializable form of the policy, embedded in the manifest so the exclusions are
 * auditable from the artifact alone. Regexes become their source strings.
 */
export function exclusionPolicySnapshot(): {
  pathPrefixes: string[];
  pathPatterns: string[];
  neverReadPatterns: string[];
} {
  return {
    pathPrefixes: [...EXCLUDED_PATH_PREFIXES].sort(),
    pathPatterns: EXCLUDED_PATH_PATTERNS.map((r) => r.source).sort(),
    neverReadPatterns: NEVER_READ_PATTERNS.map((r) => r.source).sort(),
  };
}
