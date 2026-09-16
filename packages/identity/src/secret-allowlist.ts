/**
 * Reviewed secret-scanner allow-list.
 *
 * A secret scanner that cannot be tuned produces false positives, and false
 * positives get "fixed" by disabling the scanner. This file is the alternative: an
 * explicit, reviewed, auditable list of matches that are NOT credentials.
 *
 * Rules for adding an entry:
 *   - it must be matched by (path, ruleId, redactedExcerpt), so an entry cannot
 *     silently blanket-allow a whole file or a whole rule
 *   - it must carry a reason that explains why the value is not a credential
 *   - it must record who reviewed it and when
 *
 * Crucially, this file lives in the genome. Adding or removing an entry changes the
 * fingerprint, so the allow-list cannot be quietly edited inside the same change
 * that introduces a new secret without the identity visibly moving.
 *
 * Anything matched by the scanner and NOT present here is an unexplained finding and
 * FAILS the no-secret-material check. An entry that has stopped matching anything is
 * ALSO a finding: stale exemptions quietly pre-approve a (path, rule, value) triple
 * that may later become a real secret location.
 *
 * The exemption that used to cover `.github/workflows/e2e.yml` was deleted when that
 * workflow stopped spinning up a Postgres service container. `findStaleAllowlistEntries`
 * is what caught it.
 */

export interface SecretAllowlistEntry {
  path: string;
  ruleId: string;
  /** The redacted form of the match, as produced by `redact()`. */
  redactedExcerpt: string;
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
}

export const SECRET_ALLOWLIST: readonly SecretAllowlistEntry[] = [
  {
    path: '.github/workflows/test.yml',
    ruleId: 'connection-string-with-password',
    redactedExcerpt: 'post***REDACTED***s@',
    reason:
      'Ephemeral CI service container credential for a throwaway Postgres on localhost. The container exists only for the duration of the job and is never reachable from outside the runner.',
    reviewedBy: 'genetic-identity-gate',
    reviewedAt: '2026-09-16',
  },
  {
    path: 'docker-compose.yml',
    ruleId: 'connection-string-with-password',
    redactedExcerpt: 'post***REDACTED***s@',
    reason:
      'Default local development compose credential for the bundled Postgres service. Local-only, documented as a dev default; real deployments override it via env_file.',
    reviewedBy: 'genetic-identity-gate',
    reviewedAt: '2026-09-16',
  },
  {
    path: 'tests/unit/kernel/invariants.test.ts',
    ruleId: 'openai-style-key',
    redactedExcerpt: 'sk-1***REDACTED***90',
    reason:
      'Negative test fixture. This synthetic key exists precisely so the noSecretLeak invariant can be asserted to REJECT it. Removing it would delete the test that proves secret blocking works.',
    reviewedBy: 'genetic-identity-gate',
    reviewedAt: '2026-09-16',
  },
];

export interface AllowlistMatchResult {
  allowed: boolean;
  entry: SecretAllowlistEntry | null;
}

/** Look up whether a specific finding has been reviewed and allowed. */
export function matchAllowlist(finding: {
  path: string;
  ruleId: string;
  redactedExcerpt: string;
}): AllowlistMatchResult {
  const entry =
    SECRET_ALLOWLIST.find(
      (e) =>
        e.path === finding.path &&
        e.ruleId === finding.ruleId &&
        e.redactedExcerpt === finding.redactedExcerpt,
    ) ?? null;
  return { allowed: entry !== null, entry };
}

/**
 * Partition findings into explained (allow-listed) and unexplained.
 * Only unexplained findings can fail the gate.
 */
export function partitionFindings<
  T extends { path: string; ruleId: string; redactedExcerpt: string },
>(findings: readonly T[]): {
  explained: { finding: T; reason: string }[];
  unexplained: T[];
} {
  const explained: { finding: T; reason: string }[] = [];
  const unexplained: T[] = [];

  for (const finding of findings) {
    const match = matchAllowlist(finding);
    if (match.allowed && match.entry) {
      explained.push({ finding, reason: match.entry.reason });
    } else {
      unexplained.push(finding);
    }
  }

  return { explained, unexplained };
}

/**
 * Detect allow-list entries that no longer match anything.
 *
 * A stale entry is a liability: it pre-approves a (path, rule, value) triple that
 * may later become a real secret location. Reporting them keeps the list honest.
 */
export function findStaleAllowlistEntries<
  T extends { path: string; ruleId: string; redactedExcerpt: string },
>(findings: readonly T[]): SecretAllowlistEntry[] {
  return SECRET_ALLOWLIST.filter(
    (entry) =>
      !findings.some(
        (f) =>
          f.path === entry.path &&
          f.ruleId === entry.ruleId &&
          f.redactedExcerpt === entry.redactedExcerpt,
      ),
  );
}
