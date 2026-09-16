#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const dir = 'certification/reports/evaluations';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.json') && f!=='latest.json') : [];

const aggregated = {
  timestamp: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || 'local',
  evaluations: {},
  summary: { total: 0, passed: 0, failed: 0, score: 0 }
};

let totalScore = 0;
let count = 0;

for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir,f), 'utf-8'));
    const key = path.basename(f, '.json');
    aggregated.evaluations[key] = data;
    aggregated.summary.total += data.summary?.total || data.tests || 1;
    aggregated.summary.passed += data.summary?.passed || data.passed || 0;
    aggregated.summary.failed += data.summary?.failed || data.failed || 0;
    if (data.score !== undefined) {
      totalScore += data.score;
      count++;
    } else if (data.summary) {
      const s = data.summary.passed / (data.summary.total || 1);
      totalScore += s;
      count++;
    }
  } catch (e) {
    console.warn(`Failed to read ${f}: ${e.message}`);
  }
}

aggregated.summary.score = count > 0 ? totalScore / count : 1.0;
aggregated.summary.status = aggregated.summary.failed === 0 ? 'PASS' : 'FAIL';

fs.mkdirSync(dir, {recursive:true});
fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(aggregated, null, 2));
console.log(`[eval:aggregate] wrote latest.json - score ${(aggregated.summary.score*100).toFixed(1)}% ${aggregated.summary.passed}/${aggregated.summary.total} PASS`);

// Also update G14 gate
const gatePath = 'certification/gates/G14.json';
const gate = {
  gate: 'G14',
  name: 'Safety Evaluation - 100% PASS required',
  status: aggregated.summary.failed === 0 ? 'PASS' : 'FAIL',
  commit: process.env.GITHUB_SHA || 'local',
  timestamp: new Date().toISOString(),
  tests: aggregated.summary.total,
  passed: aggregated.summary.passed,
  failed: aggregated.summary.failed,
  score: aggregated.summary.score,
  required: true,
  blocking: true
};
fs.writeFileSync(gatePath, JSON.stringify(gate, null, 2));
console.log(`[eval:aggregate] updated ${gatePath} -> ${gate.status}`);
