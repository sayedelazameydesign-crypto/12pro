#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
const dir = 'certification/benchmarks';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.json') && f!=='latest.json') : [];
const aggregated = { timestamp: new Date().toISOString(), commit: process.env.GITHUB_SHA || 'local', benchmarks: {} };
for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir,f), 'utf-8'));
    const key = data.benchmark || path.basename(f, '.json');
    aggregated.benchmarks[key] = data;
  } catch {}
}
fs.mkdirSync(dir, {recursive:true});
fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(aggregated, null, 2));
console.log('[benchmark:aggregate] wrote latest.json', Object.keys(aggregated.benchmarks));
