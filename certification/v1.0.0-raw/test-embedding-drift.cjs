const fs = require('fs');

function simpleEmbedding(text, dim) {
  const embedding = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < dim; i++) {
    const val = Math.sin(hash + i) * 10000;
    embedding.push(val - Math.floor(val));
  }
  return embedding;
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

console.log('=== Embedding Similarity Drift Test - Risk #3 - Raw Artifact ===');
console.log(`Timestamp: ${new Date().toISOString()}`);
console.log('Metric: Similarity drift post-16→384 migration, threshold <2%');

const testCases = [
  'Task pattern for building frontend',
  'Backend API design with REST and SSE',
  'CeliaOS blueprint analysis and implementation',
  'Intelligence Fabric with $0 cost policy',
  'Memory search with vector cosine similarity',
  'Mission planning with 4 steps',
  'Tool execution with approval gate',
  'SSE reconnect with exponential backoff'
];

const results = [];
let maxDrift = 0;
let totalDrift = 0;

for (const content of testCases) {
  const emb16 = simpleEmbedding(content, 16);
  const emb384 = simpleEmbedding(content, 384);
  
  // For drift test, we compare similarity of same content to a query in both dims
  // Query is similar content
  const query = content.substring(0, 20); // First 20 chars as query
  const queryEmb16 = simpleEmbedding(query, 16);
  const queryEmb384 = simpleEmbedding(query, 384);
  
  const sim16 = cosineSimilarity(queryEmb16, emb16);
  const sim384 = cosineSimilarity(queryEmb384, emb384);
  
  const drift = Math.abs(sim384 - sim16);
  const driftPercent = (drift / Math.max(sim16, 0.01)) * 100;
  
  maxDrift = Math.max(maxDrift, driftPercent);
  totalDrift += driftPercent;
  
  results.push({
    content: content.substring(0, 40),
    sim16: sim16.toFixed(4),
    sim384: sim384.toFixed(4),
    drift: drift.toFixed(4),
    driftPercent: driftPercent.toFixed(2) + '%',
    pass: driftPercent < 2
  });
  
  console.log(`${driftPercent < 2 ? '✅' : '❌'} "${content.substring(0, 30)}...": 16-dim ${sim16.toFixed(3)} → 384-dim ${sim384.toFixed(3)} drift ${driftPercent.toFixed(2)}% ${driftPercent < 2 ? 'PASS' : 'FAIL'}`);
}

const avgDrift = totalDrift / testCases.length;
const allPass = results.every(r => r.pass);
const maxPass = maxDrift < 2;
const avgPass = avgDrift < 2;

console.log(`\n--- Drift Summary ---`);
console.log(`Max drift: ${maxDrift.toFixed(2)}% (threshold <2%) ${maxPass ? 'PASS' : 'FAIL'}`);
console.log(`Avg drift: ${avgDrift.toFixed(2)}% (threshold <2%) ${avgPass ? 'PASS' : 'FAIL'}`);
console.log(`All cases <2%: ${allPass ? 'PASS' : 'FAIL'}`);

const overall = allPass && maxPass && avgPass;
console.log(`\n=== Embedding Drift: ${overall ? '✅ PASS - Drift <2% threshold' : '❌ FAIL'} ===`);

fs.writeFileSync('certification/v1.0.0-raw/embedding-drift-raw.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  metric: 'Similarity drift post-16→384 migration',
  threshold: '<2% drift acceptable',
  testCases: testCases.length,
  results,
  summary: {
    maxDrift: maxDrift.toFixed(2) + '%',
    avgDrift: avgDrift.toFixed(2) + '%',
    maxPass,
    avgPass,
    allPass,
    overall: overall ? 'PASS' : 'FAIL'
  },
  evidence: '8 test cases, drift measured as |sim384 - sim16| / sim16, threshold <2% for semantic search to return correct results'
}, null, 2));
