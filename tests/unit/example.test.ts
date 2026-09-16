import { describe, it, expect } from 'vitest';
import { AgentCoreService } from '@agi-system/agent-core';

describe('agent-core unit', () => {
  it('should init', async () => {
    const svc = new AgentCoreService({ enabled: true });
    await svc.init();
    expect(svc.health().status).toBe('ok');
  });
});
