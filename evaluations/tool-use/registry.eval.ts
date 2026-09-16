/**
 * Evaluation: Tool Use — registry integrity.
 *
 * This directory did not exist. `package.json` ("eval:tool-use") and
 * evaluation.yml both referenced `evaluations/tool-use`, so vitest exited 1
 * with "No test files found" — and `|| echo '{"status":"PASS"}'` overwrote the
 * report with a pass. Meanwhile certification/benchmarks/tool-use.json claimed
 * a 0.98 success rate for a suite that was never run.
 *
 * These assertions run against the real exported TOOL_REGISTRY, so they fail
 * if the registry is edited into an inconsistent state.
 */
import { describe, it, expect } from 'vitest';
import { TOOL_REGISTRY, ToolsService } from '@agi-system/tools';

describe('eval:tool-use:registry', () => {
  it('exposes the documented 16 tools with unique ids', () => {
    expect(TOOL_REGISTRY.length).toBe(16);
    const ids = TOOL_REGISTRY.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('splits 14 available / 2 pending', () => {
    const available = TOOL_REGISTRY.filter(t => t.status === 'available');
    const pending = TOOL_REGISTRY.filter(t => t.status === 'pending');
    expect(available.length).toBe(14);
    expect(pending.length).toBe(2);
  });

  it('keeps enabled in sync with status', () => {
    for (const tool of TOOL_REGISTRY) {
      if (tool.status === 'available') expect(tool.enabled, `${tool.id} available but disabled`).toBe(true);
      if (tool.status === 'pending') expect(tool.enabled, `${tool.id} pending but enabled`).toBe(false);
    }
  });

  it('documents why every pending tool is pending', () => {
    for (const tool of TOOL_REGISTRY.filter(t => t.status === 'pending')) {
      expect(tool.pendingReason, `${tool.id} has no pendingReason`).toBeTruthy();
      expect(tool.pendingReason!.length).toBeGreaterThan(10);
    }
  });

  it('reports success rates and latencies within valid ranges', () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.successRate, `${tool.id} successRate out of range`).toBeGreaterThanOrEqual(0);
      expect(tool.successRate, `${tool.id} successRate out of range`).toBeLessThanOrEqual(1);
      expect(tool.avgLatencyMs, `${tool.id} negative latency`).toBeGreaterThanOrEqual(0);
      // A tool that has never run must not advertise a success rate.
      if (tool.usageCount === 0) expect(tool.successRate, `${tool.id} claims a success rate with 0 usage`).toBe(0);
    }
  });

  it('assigns every tool a known category', () => {
    const allowed = new Set(['browser', 'system', 'vcs', 'knowledge', 'api', 'security', 'mcp']);
    for (const tool of TOOL_REGISTRY) {
      expect(allowed.has(tool.category), `${tool.id} has unknown category ${tool.category}`).toBe(true);
    }
  });

  it('serves the same tools through ToolsService', async () => {
    const svc = new ToolsService();
    await svc.init();
    expect(svc.getAvailable().length).toBe(14);
    expect(svc.getPending().length).toBe(2);
  });
});
