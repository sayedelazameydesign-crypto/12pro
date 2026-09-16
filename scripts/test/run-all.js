#!/usr/bin/env node
import { execSync } from 'child_process';
console.log('[test] Running full verification pipeline...');
const steps = ['lint', 'typecheck', 'test:unit', 'test:integration', 'test:contract', 'test:security'];
for (const step of steps) {
  console.log(`[test] -> ${step}`);
  try { execSync(`npm run ${step}`, { stdio: 'inherit' }); } catch(e) { console.error(`[test] ${step} FAILED`); process.exit(1); }
}
console.log('[test] All steps PASS');
