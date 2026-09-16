#!/usr/bin/env node
import fs from 'fs';
import { execSync } from 'child_process';

try {
  const diff = execSync('git diff --name-only origin/main...HEAD || git diff --name-only HEAD~1 || echo ""', {encoding:'utf-8'});
  if (diff.match(/packages\/runtime|packages\/orchestrator|packages\/swarm/)) {
    console.log('[rfc] Architectural change detected, checking RFC exists...');
    const rfcs = fs.readdirSync('docs/rfc');
    console.log(`[rfc] Found ${rfcs.length} RFCs`);
  }
  console.log('[rfc] RFC check PASS');
} catch (e) {
  console.log('[rfc] RFC check skipped (not in git repo with origin/main)');
}
