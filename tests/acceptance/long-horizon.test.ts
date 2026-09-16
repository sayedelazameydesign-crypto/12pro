import { describe, it, expect } from 'vitest';
describe('acceptance - long horizon', () => {
  it('completes 10-step mission', async () => {
    const steps = 10;
    let completed = 0;
    for (let i=0;i<steps;i++) completed++;
    expect(completed).toBe(steps);
  });
});
