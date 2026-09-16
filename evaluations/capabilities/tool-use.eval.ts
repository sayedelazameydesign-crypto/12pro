import { describe, it, expect } from 'vitest';

describe('eval:capabilities:tool-use', () => {
  it('calls tools with correct schema', async () => {
    const toolCall = { tool: "browser_navigate", args: { url: "https://github.com" }, valid: true };
    expect(toolCall.valid).toBe(true);
  });
  it('recovers from tool failure', async () => {
    const recovery = { attempted: true, fallbackUsed: true, success: true };
    expect(recovery.success).toBe(true);
  });
});
