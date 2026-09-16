import { describe, it, expect } from 'vitest';
import { ProviderRouter } from '@agi-system/intelligence-fabric';

describe('ProviderRouter - Local-First + Fallback', () => {
  it('should route chat to ollama primary', () => {
    const router = new ProviderRouter({ maxSpendUsd: 0, enableHealthCheck: false });
    const decision = router.decide({ taskType: 'chat', prompt: 'hello' });
    expect(decision.provider).toBe('ollama');
    expect(decision.estimatedCost).toBe(0);
  });

  it('should route planning to gemini (long context)', () => {
    const router = new ProviderRouter({ maxSpendUsd: 0, enableHealthCheck: false });
    const decision = router.decide({ taskType: 'planning', prompt: 'plan', requiresLongContext: true });
    expect(decision.provider).toBe('gemini');
  });

  it('should have fallback chain', () => {
    const router = new ProviderRouter({ maxSpendUsd: 0, enableHealthCheck: false });
    const decision = router.decide({ taskType: 'coding', prompt: 'code' });
    expect(decision.fallbackChain.length).toBeGreaterThan(0);
  });

  it('should enforce $0 cost in decisions', () => {
    const router = new ProviderRouter({ maxSpendUsd: 0, enableHealthCheck: false });
    const tasks = ['chat', 'coding', 'planning', 'research'] as const;
    for (const task of tasks) {
      const decision = router.decide({ taskType: task, prompt: 'test' });
      expect(decision.estimatedCost).toBe(0);
    }
  });
});
