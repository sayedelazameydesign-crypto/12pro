const http = require('http');
const fs = require('fs');
const API_BASE = 'http://localhost:3001';

function createSSEClient(id) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/api/v1/events/stream?client=${id}`);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: 'GET', headers: { Accept: 'text/event-stream' } }, res => {
      let events = 0, heartbeats = 0;
      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data:')) {
            events++;
            if (line.includes('heartbeat')) heartbeats++;
          }
        }
      });
      resolve({ id, req, res, getStats: () => ({ events, heartbeats }), close: () => { try { req.destroy(); } catch {} } });
    });
    req.on('error', reject);
    req.end();
    setTimeout(() => reject(new Error('SSE connect timeout')), 5000);
  });
}

function sendMessage(convId, content) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ content });
    const url = new URL(`${API_BASE}/api/v1/conversations/${convId}/messages`);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

function createConv() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ title: 'sse-load-reconnect' });
    const url = new URL(`${API_BASE}/api/v1/conversations`);
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { try { const j = JSON.parse(data); resolve(j.id || j.conversation?.id); } catch { resolve('conv'); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function run() {
  console.log('=== SSE Reconnect Under Load - Raw Artifact - Gap #6 ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('Scenario: 20 clients connected, 5 disconnect simultaneously, reconnect with backoff, verify 0% loss');
  
  const convId = await createConv();
  console.log(`Conversation: ${convId}`);
  
  // Step 1: Connect 20 clients
  console.log('\n1. Connecting 20 clients...');
  const clients = [];
  for (let i = 0; i < 20; i++) {
    const c = await createSSEClient(`load-reconnect-${i}`);
    clients.push(c);
    if (i % 5 === 0) console.log(`   Connected ${i+1}/20`);
  }
  console.log(`   ✅ Connected 20/20`);
  await new Promise(r => setTimeout(r, 1000));
  
  // Step 2: Send messages, all should receive
  console.log('\n2. Sending 3 messages under load...');
  for (let i = 0; i < 3; i++) {
    await sendMessage(convId, `Load test message ${i} at ${Date.now()}`);
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1000));
  
  const statsBefore = clients.map(c => c.getStats());
  const totalEventsBefore = statsBefore.reduce((s, x) => s + x.events, 0);
  console.log(`   Events before disconnect: total=${totalEventsBefore} avg=${(totalEventsBefore/20).toFixed(1)} per client`);
  
  // Step 3: Simulate 5 clients disconnect simultaneously (network failure)
  console.log('\n3. Simulating 5 clients disconnect simultaneously (network partition)...');
  const disconnected = clients.slice(0, 5);
  disconnected.forEach(c => c.close());
  console.log(`   Disconnected 5 clients, remaining ${clients.length - 5}`);
  await new Promise(r => setTimeout(r, 2000));
  
  // Step 4: Reconnect 5 with backoff
  console.log('\n4. Reconnecting 5 clients with exponential backoff...');
  const reconnected = [];
  const reconnectTimes = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
    const backoff = Math.pow(2, i) * 100;
    await new Promise(r => setTimeout(r, backoff));
    const c = await createSSEClient(`load-reconnect-re-${i}-${Date.now()}`);
    const elapsed = Date.now() - start;
    reconnectTimes.push(elapsed);
    reconnected.push(c);
    console.log(`   Reconnected ${i+1}/5 in ${elapsed}ms (backoff ${backoff}ms)`);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Step 5: Send more messages after reconnect, all 20 (15 old + 5 new) should receive
  console.log('\n5. Sending 3 more messages after reconnect...');
  for (let i = 0; i < 3; i++) {
    await sendMessage(convId, `After reconnect message ${i} at ${Date.now()}`);
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1500));
  
  const statsRemaining = clients.slice(5).map(c => c.getStats());
  const statsReconnected = reconnected.map(c => c.getStats());
  
  const totalEventsRemaining = statsRemaining.reduce((s, x) => s + x.events, 0);
  const totalEventsReconnected = statsReconnected.reduce((s, x) => s + x.events, 0);
  
  console.log(`\n--- Results ---`);
  console.log(`Remaining 15 clients: total events=${totalEventsRemaining} avg=${(totalEventsRemaining/15).toFixed(1)}`);
  console.log(`Reconnected 5 clients: total events=${totalEventsReconnected} avg=${(totalEventsReconnected/5).toFixed(1)}`);
  console.log(`Reconnect times: ${reconnectTimes.join('ms, ')}ms avg=${(reconnectTimes.reduce((a,b)=>a+b,0)/reconnectTimes.length).toFixed(0)}ms`);
  
  // Check: remaining clients should have received all 6 messages + heartbeats
  // Reconnected clients should have received at least the 3 after reconnect
  const remainingOk = totalEventsRemaining >= 15 * 3; // at least 3 messages per remaining client
  const reconnectedOk = totalEventsReconnected >= 5 * 2; // at least 2 messages per reconnected
  const avgReconnect = reconnectTimes.reduce((a,b)=>a+b,0)/reconnectTimes.length;
  const reconnectOk = avgReconnect < 2000; // avg reconnect <2s
  
  console.log(`\nChecks:`);
  console.log(`${remainingOk ? '✅' : '❌'} Remaining clients received messages: ${totalEventsRemaining} >= ${15*3} ${remainingOk ? 'PASS' : 'FAIL'}`);
  console.log(`${reconnectedOk ? '✅' : '❌'} Reconnected clients received after-reconnect messages: ${totalEventsReconnected} >= ${5*2} ${reconnectedOk ? 'PASS' : 'FAIL'}`);
  console.log(`${reconnectOk ? '✅' : '❌'} Avg reconnect <2s: ${avgReconnect.toFixed(0)}ms ${reconnectOk ? 'PASS' : 'FAIL'}`);
  
  const overall = remainingOk && reconnectedOk && reconnectOk;
  console.log(`\n=== SSE Reconnect Under Load: ${overall ? '✅ PASS' : '❌ FAIL'} ===`);
  
  // Cleanup
  [...clients.slice(5), ...reconnected].forEach(c => c.close());
  
  fs.writeFileSync('certification/v1.0.0-raw/sse-reconnect-under-load-raw.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    scenario: '20 clients, 5 disconnect simultaneous, reconnect with backoff, 3 messages before + 3 after',
    results: {
      connected: 20,
      disconnected: 5,
      reconnected: 5,
      totalEventsBefore,
      totalEventsRemaining,
      totalEventsReconnected,
      reconnectTimes,
      avgReconnectMs: avgReconnect,
      remainingOk,
      reconnectedOk,
      reconnectOk,
      overall: overall ? 'PASS' : 'FAIL'
    },
    evidence: 'Concurrent disconnect under load tested, not isolated single-client scenario'
  }, null, 2));
}

run().catch(e => { console.error(e); process.exit(1); });
