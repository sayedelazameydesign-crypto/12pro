#!/usr/bin/env node
const env = process.argv.find(a=>a.startsWith('--env'))?.split('=')[1] || 'production';
console.log(`[health-check] Checking ${env}...`);
console.log('[health-check] /api/v1/health -> 200 OK (simulated)');
