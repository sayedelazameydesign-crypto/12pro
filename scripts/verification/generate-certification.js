#!/usr/bin/env node
/**
 * Generate certification manifest for release
 */
import fs from 'fs';
import path from 'path';

const commit = process.argv.find(a=>a.startsWith('--commit'))?.split('=')[1] || process.env.GITHUB_SHA || 'local';
const version = process.argv.find(a=>a.startsWith('--version'))?.split('=')[1] || '0.1.0';

const manifest = {
  version,
  commit,
  timestamp: new Date().toISOString(),
  gates: {},
  reports: {},
  benchmarks: {},
  artifacts: []
};

const gatesDir = 'certification/gates';
if (fs.existsSync(gatesDir)) {
  for (const f of fs.readdirSync(gatesDir).filter(x=>x.endsWith('.json'))) {
    try { manifest.gates[path.basename(f,'.json')] = JSON.parse(fs.readFileSync(path.join(gatesDir,f),'utf-8')); } catch {}
  }
}

const reportsDir = 'certification/reports';
if (fs.existsSync(reportsDir)) {
  for (const f of fs.readdirSync(reportsDir).filter(x=>x.endsWith('.json'))) {
    try { manifest.reports[path.basename(f,'.json')] = JSON.parse(fs.readFileSync(path.join(reportsDir,f),'utf-8')); } catch {}
  }
}

const benchDir = 'certification/benchmarks';
if (fs.existsSync(benchDir)) {
  for (const f of fs.readdirSync(benchDir).filter(x=>x.endsWith('.json'))) {
    try { manifest.benchmarks[path.basename(f,'.json')] = JSON.parse(fs.readFileSync(path.join(benchDir,f),'utf-8')); } catch {}
  }
}

fs.mkdirSync('certification/manifests', {recursive:true});
const out = `certification/manifests/release-${version}.json`;
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
fs.writeFileSync('certification/manifests/latest.json', JSON.stringify(manifest, null, 2));
console.log(`[certify] Wrote ${out}`);
console.log(`[certify] Gates: ${Object.keys(manifest.gates).length}, Reports: ${Object.keys(manifest.reports).length}`);
