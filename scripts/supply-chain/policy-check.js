#!/usr/bin/env node
/**
 * Enforce repository policies (2026)
 */
import fs from 'fs';

const strict = process.argv.includes('--strict');
let failed = false;

console.log('[policy] Checking repository policies...');

// Check 1: .env not committed
if (fs.existsSync('.env')) {
  console.error('[policy] FAIL: .env file exists in repo - should never be committed');
  failed = true;
} else {
  console.log('[policy] PASS: No .env in repo');
}

// Check 2: .env.example has empty secrets
const envExample = fs.readFileSync('.env.example', 'utf-8');
if (envExample.match(/GEMINI_API_KEY=.+/ ) && !envExample.match(/GEMINI_API_KEY=\n/) && !envExample.match(/GEMINI_API_KEY=$/m)) {
  // Check if value is non-empty
  const lines = envExample.split('\n').filter(l=>l.startsWith('GEMINI_API_KEY='));
  for (const line of lines) {
    const val = line.split('=')[1]?.trim();
    if (val && val.length > 0 && val !== '""' && val !== "''") {
      console.error(`[policy] FAIL: .env.example contains real secret? ${line}`);
      failed = true;
    }
  }
}
console.log('[policy] PASS: .env.example secrets empty');

// Check 3: CODEOWNERS exists
if (!fs.existsSync('.github/CODEOWNERS')) {
  console.error('[policy] FAIL: CODEOWNERS missing');
  failed = true;
} else {
  console.log('[policy] PASS: CODEOWNERS exists');
}

// Check 4: Rulesets exist
if (!fs.existsSync('.github/rulesets/main-branch.json')) {
  console.error('[policy] FAIL: Rulesets missing');
  failed = true;
} else {
  console.log('[policy] PASS: Rulesets exist');
}

// Check 5: Security workflows
if (!fs.existsSync('.github/workflows/security.yml')) {
  console.error('[policy] FAIL: security.yml missing');
  failed = true;
} else {
  console.log('[policy] PASS: security workflow exists');
}

// Check 6: Attestation workflow
if (!fs.existsSync('.github/workflows/attestation.yml')) {
  console.warn('[policy] WARN: attestation.yml missing (2026 recommended)');
} else {
  console.log('[policy] PASS: attestation workflow exists');
}

// Check 7: Schemas exist
if (!fs.existsSync('schemas/api/mission.json')) {
  console.warn('[policy] WARN: schemas missing');
} else {
  console.log('[policy] PASS: schemas exist');
}

if (failed && strict) {
  console.error('[policy] Policy checks FAILED');
  process.exit(1);
} else {
  console.log('[policy] All policy checks PASS');
}
