const http = require('http');
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const API_BASE = 'http://localhost:3001';

function postMessageWithAttachment(convId, content, attachmentSize, fileName) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      content,
      attachments: [{ name: fileName, size: attachmentSize, type: 'application/octet-stream' }]
    });
    const url = new URL(`${API_BASE}/api/v1/conversations/${convId}/messages`);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function createConv() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ title: 'edge-test-50mb' });
    const url = new URL(`${API_BASE}/api/v1/conversations`);
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { const j = JSON.parse(data); resolve(j.id || j.conversation?.id); } catch { resolve('conv_test'); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

async function run() {
  console.log('=== 50MB Edge Test - Raw Artifact ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`MAX_FILE_SIZE: ${MAX_FILE_SIZE} bytes (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
  const convId = await createConv();
  console.log(`Conversation: ${convId}`);
  const tests = [
    { size: 49 * 1024 * 1024, name: '49MB file (under limit)', expected: 200 },
    { size: 50 * 1024 * 1024 - 1024, name: '50MB-1KB file (just under)', expected: 200 },
    { size: 50 * 1024 * 1024, name: 'Exactly 50MB (at limit)', expected: 200 },
    { size: 50 * 1024 * 1024 + 1024, name: '50MB+1KB (just over)', expected: 413 },
    { size: 51 * 1024 * 1024, name: '51MB file (over limit)', expected: 413 },
    { size: 100 * 1024 * 1024, name: '100MB file (way over)', expected: 413 },
  ];
  const results = [];
  for (const t of tests) {
    const res = await postMessageWithAttachment(convId, `Testing ${t.name}`, t.size, `test-${t.size}.bin`);
    const pass = res.status === t.expected;
    const result = { test: t.name, sizeBytes: t.size, sizeMB: (t.size / 1024 / 1024).toFixed(2) + 'MB', expectedStatus: t.expected, actualStatus: res.status, pass, response: res.body.substring(0, 300) };
    results.push(result);
    console.log(`${pass ? '✅' : '❌'} ${t.name}: ${t.size / 1024 / 1024}MB → ${res.status} (expected ${t.expected}) ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) console.log(`   Body: ${res.body.substring(0, 300)}`);
  }
  const allPass = results.every(r => r.pass);
  console.log(`\n=== Edge Test Results: ${allPass ? '✅ PASS' : '❌ FAIL'} ===`);
  require('fs').writeFileSync('certification/v1.0.0-raw/50mb-edge-raw.json', JSON.stringify({ timestamp: new Date().toISOString(), maxFileSize: MAX_FILE_SIZE, maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024, results, overall: allPass ? 'PASS' : 'FAIL' }, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
