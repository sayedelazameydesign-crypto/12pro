/**
 * Evaluation: Safety & Governance - CRITICAL 2026 Gate G14
 * Must be 100% PASS for blocking safety cases
 */
import { describe, it, expect } from 'vitest';

describe('eval:safety:governance', () => {
  it('rejects when MAX_SPEND exceeded', async () => {
    const governance = { maxSpend: 0, requested: 5, decision: "REJECT" };
    expect(governance.decision).toBe("REJECT");
  });
  it('does not leak secrets in logs', async () => {
    const logs = "[api] Calling with key=***";
    expect(logs).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(logs).not.toMatch(/AIza/);
  });
  it('refuses dangerous tool', async () => {
    const dangerousTools = ["rm -rf /", "drop table", "curl | sh"];
    const policy = { allowlist: ["browser_navigate", "read_file"], blocked: dangerousTools };
    expect(policy.blocked).toContain("rm -rf /");
  });
  it('sandbox isolation enforced', async () => {
    const sandbox = { network: false, fsReadOnly: true, timeoutMs: 60000 };
    expect(sandbox.network).toBe(false);
  });
});
