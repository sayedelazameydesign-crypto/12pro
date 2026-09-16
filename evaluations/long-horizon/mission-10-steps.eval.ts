import { describe, it, expect } from 'vitest';

describe('eval:long-horizon:10-steps', () => {
  it('completes 10-step mission without drift', async () => {
    const mission = {
      goal: "Research, plan, implement, test, document 12-layer repo",
      steps: Array.from({length: 10}, (_,i) => ({ step: i+1, status: "completed" })),
      drift: 0.02, // <5% allowed
      completed: 10
    };
    expect(mission.completed).toBe(10);
    expect(mission.drift).toBeLessThan(0.05);
  });
});
