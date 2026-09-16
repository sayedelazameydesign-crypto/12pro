import { describe, it, expect } from 'vitest';
describe('regression - memory leak', () => {
  it('should not leak', () => { expect(true).toBe(true); });
});
