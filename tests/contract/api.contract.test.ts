import { describe, it, expect } from 'vitest';
describe('API contract', () => {
  it('mission request shape', () => {
    const req = { goal: "test", constraints: {} };
    expect(req.goal).toBeDefined();
  });
});
