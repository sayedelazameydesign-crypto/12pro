import { describe, it, expect } from 'vitest';
import {
  scanTextForSecrets,
  redact,
  SECRET_RULES,
  secretRuleInventory,
  SECRET_ALLOWLIST,
  matchAllowlist,
  partitionFindings,
  findStaleAllowlistEntries,
} from '@agi-system/identity';

/**
 * Fixtures are assembled at RUNTIME so that this source file contains no literal
 * credential-shaped string.
 *
 * A negative test fixture is byte-for-byte indistinguishable from a real key to any
 * scanner. Writing it as a literal would force an allow-list entry for a file that is
 * supposed to prove secrets get caught, which inverts the point of the allow-list.
 * Splitting each fixture across a concatenation keeps the runtime value exact (so the
 * detection assertions are unchanged) while keeping the committed tree free of
 * secret-shaped text.
 */
const cat = (...parts: string[]): string => parts.join('');

describe('identity / secret detection', () => {
  it('has a non-trivial rule set', () => {
    expect(SECRET_RULES.length).toBeGreaterThanOrEqual(10);
    expect(secretRuleInventory().length).toBe(SECRET_RULES.length);
    for (const rule of SECRET_RULES) {
      expect(rule.id.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });

  it('detects provider and cloud credential shapes', () => {
    const cases: [string, string][] = [
      [cat('const k = "sk-', 'abcdefghij0123456789ABCDEF', '";'), 'openai-style-key'],
      [cat('AWS_KEY=AKIA', 'IOSFODNN7EXAMPLE'), 'aws-access-key-id'],
      [cat('key: AIza', 'SyA1234567890abcdefghijklmnopqrstuv'), 'google-api-key'],
      [cat('token = ghp_', 'abcdefghijklmnopqrstuvwxyz0123'), 'github-token'],
      [cat('HF=hf_', 'abcdefghijklmnopqrstuvwxyz'), 'hf-token'],
      [cat('NVIDIA=nvapi-', 'abcdefghijklmnopqrstuvwxyz'), 'nvapi-key'],
      [cat('GROQ=gsk_', 'abcdefghijklmnopqrstuvwxyz'), 'groq-key'],
    ];
    for (const [text, ruleId] of cases) {
      const findings = scanTextForSecrets(text, 'x.ts', { treatPlaceholdersAsFindings: true });
      expect(findings.some((f) => f.ruleId === ruleId), `${ruleId} in ${text}`).toBe(true);
    }
  });

  it('detects PEM private key blocks and JWTs', () => {
    expect(scanTextForSecrets(cat('-----BEGIN RSA ', 'PRIVATE KEY-----'), 'k.pem').some((f) => f.ruleId === 'private-key-block')).toBe(true);
    const jwt = cat('eyJhbGciOiJIUzI1NiJ9.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0.', 'abcdefghijklmnopqrstuv');
    expect(scanTextForSecrets(jwt, 'a.ts').some((f) => f.ruleId === 'jwt')).toBe(true);
  });

  it('ignores documented placeholders by default', () => {
    const findings = scanTextForSecrets('OPENAI_API_KEY=sk-your-key-here-xxxxxxxxxxxx', '.env.example');
    expect(findings.length).toBe(0);
  });

  it('can be forced to report placeholders when the caller asks', () => {
    const findings = scanTextForSecrets('OPENAI_API_KEY=sk-your-key-here-xxxxxxxxxxxx', '.env.example', {
      treatPlaceholdersAsFindings: true,
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.looksLikePlaceholder).toBe(true);
  });

  it('never returns the raw secret in a finding', () => {
    const secret = cat('sk-', 'abcdefghijklmnopqrstuvwxyz012345');
    const findings = scanTextForSecrets(`const k = "${secret}";`, 'a.ts', { treatPlaceholdersAsFindings: true });
    expect(findings.length).toBe(1);
    const finding = findings[0];
    expect(finding).toBeDefined();
    expect(finding!.redactedExcerpt).not.toContain(secret);
    expect(finding!.redactedExcerpt).toContain('REDACTED');
    expect(JSON.stringify(finding)).not.toContain(secret);
  });

  it('redacts short matches without leaking them whole', () => {
    expect(redact('abc')).toBe('ab***');
    expect(redact('abcdefghijkl')).toContain('REDACTED');
    expect(redact('abcdefghijkl')).not.toBe('abcdefghijkl');
  });

  it('reports the line number of a finding', () => {
    const text = cat('line one\nline two\nconst k = "sk-', 'abcdefghij0123456789ABCDEF', '";\n');
    const findings = scanTextForSecrets(text, 'a.ts', { treatPlaceholdersAsFindings: true });
    expect(findings[0]?.line).toBe(3);
  });

  describe('reviewed allow-list', () => {
    it('matches only on the exact (path, rule, value) triple', () => {
      const entry = SECRET_ALLOWLIST[0];
      expect(entry).toBeDefined();
      const exact = matchAllowlist({
        path: entry!.path,
        ruleId: entry!.ruleId,
        redactedExcerpt: entry!.redactedExcerpt,
      });
      expect(exact.allowed).toBe(true);

      // Same rule and value at a different path is NOT allowed.
      expect(
        matchAllowlist({ path: 'some/other/file.yml', ruleId: entry!.ruleId, redactedExcerpt: entry!.redactedExcerpt })
          .allowed,
      ).toBe(false);

      // Same path and rule but a different value is NOT allowed.
      expect(
        matchAllowlist({ path: entry!.path, ruleId: entry!.ruleId, redactedExcerpt: 'sk-1***REDACTED***zz' })
          .allowed,
      ).toBe(false);
    });

    it('every entry carries a reason, a reviewer and a review date', () => {
      for (const entry of SECRET_ALLOWLIST) {
        expect(entry.reason.length, `${entry.path} reason`).toBeGreaterThan(20);
        expect(entry.reviewedBy.length).toBeGreaterThan(0);
        expect(entry.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('partitions findings into explained and unexplained', () => {
      const entry = SECRET_ALLOWLIST[0]!;
      const explainedFinding = { path: entry.path, ruleId: entry.ruleId, redactedExcerpt: entry.redactedExcerpt, line: 1 };
      const unexplainedFinding = { path: 'src/new.ts', ruleId: 'openai-style-key', redactedExcerpt: 'sk-a***REDACTED***zz', line: 9 };

      const { explained, unexplained } = partitionFindings([explainedFinding, unexplainedFinding]);
      expect(explained.length).toBe(1);
      expect(explained[0]?.reason).toBe(entry.reason);
      expect(unexplained.length).toBe(1);
      expect(unexplained[0]?.path).toBe('src/new.ts');
    });

    it('flags allow-list entries that no longer match anything', () => {
      const stale = findStaleAllowlistEntries([]);
      expect(stale.length).toBe(SECRET_ALLOWLIST.length);

      const entry = SECRET_ALLOWLIST[0]!;
      const stillUsed = findStaleAllowlistEntries([
        { path: entry.path, ruleId: entry.ruleId, redactedExcerpt: entry.redactedExcerpt },
      ]);
      expect(stillUsed.length).toBe(SECRET_ALLOWLIST.length - 1);
    });
  });
});
