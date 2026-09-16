/**
 * Secret-material detection for the genome.
 *
 * The genome must never contain credential material. Detection is layered:
 *   1. PATH rules   - files that are secret containers by nature are never even
 *                     read into the leaves (see exclusions.ts / NEVER_READ_PATTERNS).
 *   2. CONTENT rules - high-signal patterns for provider keys, cloud keys, private
 *                     keys, bearer tokens and connection strings with credentials.
 *
 * Patterns are deliberately high-signal to avoid failing the gate on documentation
 * that merely mentions the word "token". Every finding carries the matched rule id
 * and a REDACTED excerpt - the raw secret is never written into any artifact.
 */
import { readFileSync } from 'node:fs';

import { mustNeverRead, toRepoRelativePosixPath } from './exclusions.ts';

export interface SecretRule {
  id: string;
  description: string;
  pattern: RegExp;
}

/** High-signal credential patterns. */
export const SECRET_RULES: readonly SecretRule[] = [
  {
    id: 'openai-style-key',
    description: 'OpenAI-compatible secret key (sk-...)',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'aws-access-key-id',
    description: 'AWS access key id',
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/,
  },
  {
    id: 'google-api-key',
    description: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    id: 'github-token',
    description: 'GitHub personal access / app token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  },
  {
    id: 'slack-token',
    description: 'Slack token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    id: 'stripe-secret-key',
    description: 'Stripe secret key',
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  },
  {
    id: 'hf-token',
    description: 'Hugging Face access token',
    pattern: /\bhf_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: 'nvapi-key',
    description: 'NVIDIA NIM / API key',
    pattern: /\bnvapi-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: 'groq-key',
    description: 'Groq API key',
    pattern: /\bgsk_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: 'private-key-block',
    description: 'PEM private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    id: 'jwt',
    description: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  {
    id: 'connection-string-with-password',
    description: 'Connection string embedding credentials',
    pattern: /\b(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^/\s:@]+:[^/\s:@]+@/i,
  },
  {
    id: 'generic-authorization-header',
    description: 'Hardcoded Authorization: Bearer header value',
    pattern: /["']authorization["']\s*:\s*["']Bearer\s+[A-Za-z0-9._~+/-]{16,}={0,2}["']/i,
  },
];

/** Values that look like a key but are placeholders, allowed in examples/docs. */
export const PLACEHOLDER_HINTS: readonly RegExp[] = [
  /your[-_]?/i,
  /xxxx+/i,
  /placeholder/i,
  /example/i,
  /changeme/i,
  /<[^>]+>/,
  /\$\{[^}]+\}/,
  /process\.env\./,
  /redacted/i,
  /dummy/i,
  /fake/i,
];

export interface SecretFinding {
  path: string;
  ruleId: string;
  description: string;
  line: number;
  /** Match with the sensitive middle replaced. Never the raw secret. */
  redactedExcerpt: string;
  /** True when the match looks like a documented placeholder. */
  looksLikePlaceholder: boolean;
}

/** Replace the middle of a match so artifacts can quote it safely. */
export function redact(match: string): string {
  if (match.length <= 8) return `${match.slice(0, 2)}***`;
  return `${match.slice(0, 4)}***REDACTED***${match.slice(-2)}`;
}

/** Scan a single string for secret patterns. */
export function scanTextForSecrets(
  text: string,
  path: string,
  options: { treatPlaceholdersAsFindings?: boolean } = {},
): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    for (const rule of SECRET_RULES) {
      const match = rule.pattern.exec(line);
      if (!match) continue;
      const looksLikePlaceholder = PLACEHOLDER_HINTS.some((hint) => hint.test(line));
      if (looksLikePlaceholder && !options.treatPlaceholdersAsFindings) continue;
      findings.push({
        path: toRepoRelativePosixPath(path),
        ruleId: rule.id,
        description: rule.description,
        line: i + 1,
        redactedExcerpt: redact(match[0]),
        looksLikePlaceholder,
      });
    }
  }
  return findings;
}

/**
 * Scan the repository leaves for secret material.
 *
 * Returns both `findings` (real, non-placeholder hits) and `blockedPaths`
 * (files that were never read because they are secret containers by nature).
 */
export function scanRepositoryForSecrets(
  leaves: readonly { path: string }[],
  root: string,
  options: { maxFiles?: number; treatPlaceholdersAsFindings?: boolean } = {},
): { findings: SecretFinding[]; blockedPaths: string[]; scannedFiles: number } {
  const findings: SecretFinding[] = [];
  const blockedPaths: string[] = [];
  let scannedFiles = 0;
  const maxFiles = options.maxFiles ?? leaves.length;

  // Binary-ish extensions we do not text-scan.
  const skipExt = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|tar|woff2?|ttf|eot|mp4|mp3|wav|bin|so|dylib|dll|exe|lock)$/i;

  for (const leaf of leaves) {
    if (scannedFiles >= maxFiles) break;
    const rel = toRepoRelativePosixPath(leaf.path);

    if (mustNeverRead(rel)) {
      blockedPaths.push(rel);
      continue;
    }
    if (skipExt.test(rel)) continue;

    let text: string;
    try {
      text = readFileSync(`${root}/${rel}`, 'utf-8');
    } catch {
      continue;
    }
    // Cheap binary guard.
    if (text.includes('\u0000')) continue;

    scannedFiles++;
    findings.push(
      ...scanTextForSecrets(text, rel, {
        treatPlaceholdersAsFindings: options.treatPlaceholdersAsFindings ?? false,
      }),
    );
  }

  return { findings, blockedPaths, scannedFiles };
}

/** Serializable rule inventory, embedded in the G16 evidence. */
export function secretRuleInventory(): { id: string; description: string }[] {
  return SECRET_RULES.map((r) => ({ id: r.id, description: r.description }));
}
