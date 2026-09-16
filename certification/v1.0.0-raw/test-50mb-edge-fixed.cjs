const http = require('http');
const fs = require('fs');
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const API_BASE = 'http://localhost:3001';

function postMessageWithAttachment(convId, content, attachmentSize, fileName) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ content, attachments: [{ name: fileName, size: attachmentSize, type: 'application/octet-stream' }] });
    const url = new URL(`${API_BASE}/api/v1/conversations/${convId}/messages`);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
function createConv() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ title: 'edge-test-50mb' });
    const url = new URL(`${API_BASE}/api/v1/conversations`);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { try { const j = JSON.parse(data); resolve(j.id || j.conversation?.id); } catch { resolve('conv_test'); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
async function run() {
  console.log('=== 50MB Edge Test - FIXED (201 = created) - Raw Artifact ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  const convId = await createConv();
  console.log(`Conversation: ${convId}`);
  const tests = [
    { size: 49 * 1024 * 1024, name: '49MB file (under limit)', shouldAllow: true },
    { size: 50 * 1024 * 1024 - 1024, name: '50MB-1KB file (just under)', shouldAllow: true },
    { size: 50 * 1024 * 1024, name: 'Exactly 50MB (at limit)', shouldAllow: true },
    { size: 50 * 1024 * 1024 + 1024, name: '50MB+1KB (just over)', shouldAllow: false },
    { size: 51 * 1024 * 1024, name: '51MB file (over limit)', shouldAllow: false },
    { size: 100 * 1024 * 1024, name: '100MB file (way over)', shouldAllow: false },
  ];
  const results = [];
  for (const t of tests) {
    const res = await postMessageWithAttachment(convId, `Testing ${t.name}`, t.size, `test-${t.size}.bin`);
    const isAllowed = res.status === 200 || res.status === 201;
    const isBlocked = res.status === 413;
    const pass = t.shouldAllow ? isAllowed : isBlocked;
    const result = { test: t.name, sizeBytes: t.size, sizeMB: (t.size / 1024 / 1024).toFixed(4) + 'MB', shouldAllow: t.shouldAllow, actualStatus: res.status, allowed: isAllowed, blocked: isBlocked, pass };
    results.push(result);
    console.log(`${pass ? '✅' : '❌'} ${t.name}: ${result.sizeMB} → ${res.status} (shouldAllow=${t.shouldAllow}) ${pass ? 'PASS' : 'FAIL'}`);
    if (res.status === 413) {
      try { console.log(`   Block response: ${res.body.substring(0, 200)}`); } catch {}
    }
  }
  const allPass = results.every(r => r.pass);
  console.log(`\n=== Edge Test Results: ${allPass ? '✅ PASS - 50MB limit enforced correctly at boundary' : '❌ FAIL'} ===`);
  fs.writeFileSync('certification/v1.0.0-raw/50mb-edge-raw.json', JSON.stringify({ timestamp: new Date().toISOString(), maxFileSize: MAX_FILE_SIZE, maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024, results, overall: allPass ? 'PASS' : 'FAIL', evidence: 'Boundary tested at 49MB, 50MB-1KB, 50MB, 50MB+1KB, 51MB, 100MB' }, null, 2));
}
run().catch(e => { console.error(e); process.exit(1); });
