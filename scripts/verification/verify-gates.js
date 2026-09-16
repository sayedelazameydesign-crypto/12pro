#!/usr/bin/env node
/**
 * Verify certification gates - blocks merge if required gate fails
 */
import fs from 'fs';
import path from 'path';

const gatesArg = process.argv.find(a=>a.startsWith('--gates'))?.split('=')[1];
const requestedGates = gatesArg ? gatesArg.split(',') : null;
const commitArg = process.argv.find(a=>a.startsWith('--commit'))?.split('=')[1] || 'local';
const strict = process.argv.includes('--strict');

const gatesDir = 'certification/gates';
const files = fs.existsSync(gatesDir) ? fs.readdirSync(gatesDir).filter(f=>f.endsWith('.json')) : [];

let allPass = true;
console.log(`[verify] Checking gates for commit ${commitArg}...`);
for (const file of files) {
  const gateName = path.basename(file, '.json');
  if (requestedGates && !requestedGates.includes(gateName)) continue;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(gatesDir,file), 'utf-8'));
    const status = data.status;
    console.log(`[verify] ${gateName}: ${status} (${data.passed}/${data.tests})`);
    if (status !== 'PASS') allPass = false;
  } catch(e) {
    console.warn(`[verify] ${gateName}: missing or invalid - ${e.message}`);
    if (strict) allPass = false;
  }
}

if (!allPass) {
  console.error('[verify] Gates FAILED - merge blocked');
  if (strict || process.env.CI) process.exit(1);
} else {
  console.log('[verify] All gates PASS');
}
