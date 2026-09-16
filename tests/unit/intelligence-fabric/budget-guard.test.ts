import { describe, it, expect } from 'vitest';
import { BudgetGuard } from '@agi-system/intelligence-fabric';

describe('BudgetGuard - MAX_SPEND=0', () => {
  it('should block any cost > 0 when MAX_SPEND=0', () => {
    const guard = new BudgetGuard({ maxSpendUsd: 0 });
    const decision = {
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      reason: 'test',
      estimatedCost: 0.001,
      taskType: 'chat' as const,
      fallbackChain: [],
      confidence: 0.9
    };
    const result = guard.check(decision);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('exceeds MAX_SPEND');
  });

  it('should allow $0 cost', () => {
    const guard = new BudgetGuard({ maxSpendUsd: 0 });
    const decision = {
      provider: 'ollama' as const,
      model: 'llama3.2:latest',
      reason: 'local',
      estimatedCost: 0,
      taskType: 'chat' as const,
      fallbackChain: [],
      confidence: 0.9
    };
    const result = guard.check(decision);
    expect(result.allowed).toBe(true);
  });

  it('should block unknown cost when policy says so', () => {
    const guard = new BudgetGuard({ maxSpendUsd: 0, blockUnknownCost: true } as any);
    const decision = {
      provider: 'nvidia' as const,
      model: 'test',
      reason: 'test',
      estimatedCost: undefined as any,
      taskType: 'chat' as const,
      fallbackChain: [],
      confidence: 0.9
    };
    const result = guard.check(decision);
    expect(result.allowed).toBe(false);
  });

  it('should track spend and report status', () => {
    const guard = new BudgetGuard({ maxSpendUsd: 0 });
    guard.recordUsage('ollama', 0);
    const status = guard.getStatus();
    expect(status.totalSpend).toBe(0);
    expect(status.maxSpend).toBe(0);
    expect(status.policy.maxSpendUsd).toBe(0);
  });

  it('should validate cost is zero', () => {
    const guard = new BudgetGuard({ maxSpendUsd: 0 });
    expect(guard.validateCost('ollama', 0, true)).toBe(true);
    expect(guard.validateCost('gemini', 0.001, false)).toBe(false);
  });
});
