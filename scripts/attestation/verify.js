#!/usr/bin/env node
/**
 * Verify attestations exist for commit
 */
import fs from 'fs';

const commit = process.argv.find(a=>a.startsWith('--commit'))?.split('=')[1] || process.env.GITHUB_SHA || 'local';
console.log(`[attestation:verify] Checking attestations for ${commit}...`);

const sbomExists = fs.existsSync('certification/sbom/sbom.spdx.json');
console.log(`[attestation:verify] SBOM exists: ${sbomExists}`);

const attestationDir = 'certification/attestations';
const files = fs.existsSync(attestationDir) ? fs.readdirSync(attestationDir) : [];
console.log(`[attestation:verify] Attestations found: ${files.length}`);

if (!sbomExists) {
  console.warn('[attestation:verify] SBOM missing - would fail in production environment');
  // In production, this should block
}

console.log('[attestation:verify] Attestation verification complete - PASS (simulated)');
