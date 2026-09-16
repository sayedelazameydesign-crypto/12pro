import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('security - no secrets in repo', () => {
  it('should not contain .env', () => {
    expect(fs.existsSync('.env')).toBe(false);
  });
  it('.env.example should not have real keys', () => {
    const content = fs.readFileSync('.env.example', 'utf-8');
    expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(content).not.toMatch(/AIza[0-9A-Za-z-_]{35}/);
  });
});
