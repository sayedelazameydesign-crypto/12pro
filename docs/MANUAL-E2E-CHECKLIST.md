# Manual E2E Checklist - CeliaOS Control Plane
## 5 اختبارات × 5-8 دقائق = 25-40 دقيقة → Go/No-Go Decision

تاريخ: 2026-09-16
فرع: arena/01a0a9e0-12pro
المتطلبات: 3 terminals (Backend, Frontend, Logs)

---

## الإعداد (3 دقائق)

```bash
git checkout arena/01a0a9e0-12pro
npm install

# Terminal 1: Backend (مع كل الإصلاحات)
npx tsx services/api-server/src/index.ts
# Expected: Listening on 0.0.0.0:3001, SSE max 100, Tools 14/16

# Terminal 2: Frontend
cd apps/web && npm install && npm run dev
# Expected: http://localhost:3000, Next.js 14, RTL

# Terminal 3: Logs + Automated baseline
node scripts/e2e-celiaos-test.js > /tmp/e2e-results.log 2>&1 &
curl http://localhost:3001/api/v1/sse/stats > /tmp/sse-stats.json
cat /tmp/e2e-results.log | tail -n 20
```

**Baseline يجب أن يكون**:
```
✅ All checks PASS - 10/10
P95 14ms, 0% loss, 100% heartbeat, 50/50 connected
```

---

## Test 1: SSE Disconnect + Reconnect (5 دقائق)

**الهدف**: اختبار reconnection logic + backpressure + heartbeat

**الخطوات**:
1. افتح http://localhost:3000/chat/conv_seed_001
2. افتح DevTools → Network → حاول إرسال رسالة → تأكد SSE متصل (Status 200)
3. في DevTools → Network → اختر "Offline" من throttling dropdown
4. انتظر 5 ثوانٍ → يجب أن ترى في Console: `[sse] Error` + `Reconnecting in Xm`
5. عد إلى "Online" → انتظر 3 ثوانٍ
6. أرسل رسالة جديدة: "اختبار إعادة الاتصال"

**المتوقع**:
- ✓ Console يظهر reconnect مع exponential backoff + jitter
- ✓ بعد Online، SSE يعيد الاتصال تلقائياً
- ✓ الرسالة الجديدة تصل عبر SSE (لا ضياع)
- ✓ Heartbeat يعود (كل 15s)

**الفشل**:
- ✗ SSE لا يعيد الاتصال → No-Go → تحقق من `sse/client.ts` reconnect logic
- ✗ Events ضاعت بعد reconnect → No-Go → تحقق من queue persistence

**التسجيل**:
```
Test 1: SSE Reconnect - PASS/FAIL
- Disconnect detected: YES/NO
- Reconnect time: Xms
- Message loss after reconnect: 0% / X%
- Go/No-Go: GO/NO-GO
```

---

## Test 2: localStorage Corruption + Persistence (5 دقائق)

**الهدف**: اختبار file persistence (mission-ledger + memory-fabric) vs localStorage

**الخطوات**:
1. افتح http://localhost:3000/chat
2. أنشئ محادثة جديدة → أرسل 2 رسائل
3. افتح Console:
   ```js
   localStorage.clear();
   sessionStorage.clear();
   console.log('Cleared');
   ```
4. أعد تحميل الصفحة (F5)
5. تحقق: هل المحادثات لا تزال موجودة؟
6. تحقق من Network: `GET /api/v1/conversations` → هل يعيد المحادثات؟

**المتوقع**:
- ✓ بعد clear + reload، المحادثات تعود من backend (file persistence)
- ✓ `GET /conversations` يعيد نفس المحادثات
- ✓ Messages لا تضيع (من `certification/mission-ledger/missions.json`)
- ✓ Memory stats لا تزال 9703 records

**الفشل**:
- ✗ المحادثات ضاعت → No-Go → تحقق من file persistence في `memory-fabric.ts` و `mission-ledger`
- ✗ Messages ضاعت → No-Go → تحقق من `services/api-server` stores

**التسجيل**:
```
Test 2: Persistence - PASS/FAIL
- Conversations after clear: X (expected >=1)
- Messages after reload: X (expected >=2)
- Memory total: X (expected 9703)
- Go/No-Go: GO/NO-GO
```

---

## Test 3: Mission State مع Nested Tasks (8 دقائق)

**الهدف**: اختبار multi-agent flow Planner→Coder→Reviewer

**الخطوات**:
1. افتح http://localhost:3000/missions
2. أنشئ مهمة جديدة:
   ```json
   {
     "goal": "Build feature with multi-agent: Planner→Coder→Reviewer",
     "plan": {
       "steps": [
         { "task": "Planner: decompose goal into 3 tasks" },
         { "task": "Coder: implement feature in apps/web" },
         { "task": "Reviewer: review code (different model than coder)" },
         { "task": "Verifier: verify with second model" }
       ]
     }
   }
   ```
   (استخدم UI أو `POST /api/v1/missions`)
3. ابدأ المهمة: `POST /api/v1/missions/:id/start`
4. تابع في Mission Cockpit:
   - هل Plan Timeline يظهر 4 steps؟
   - هل كل step يتحول من pending → running → completed؟
   - هل Tool Activity يظهر (browser, filesystem, memory)؟
5. تحقق من Intelligence Fabric routing:
   - Coder → ollama/codellama
   - Reviewer → gemini (different model per task-router.ts logic)

**المتوقع**:
- ✓ Mission created with 4 steps
- ✓ Steps status تتغير في real-time عبر SSE
- ✓ Tool Activity يظهر مع latency
- ✓ Reviewer uses different model than Coder (per `task-router.ts`)
- ✓ Cost $0 في كل steps

**الفشل**:
- ✗ Steps لا تتغير → No-Go → تحقق من SSE `mission.step.started/completed`
- ✗ Reviewer نفس model كـ Coder → No-Go → تحقق من `task-router.ts` multi-agent logic
- ✗ Cost >0 → No-Go → تحقق من Budget Guard

**التسجيل**:
```
Test 3: Multi-agent Mission - PASS/FAIL
- Steps: 4/4 created
- Status changes via SSE: YES/NO
- Tool Activity count: X
- Coder model: codellama, Reviewer model: gemini (different: YES/NO)
- Cost: $0 (PASS/FAIL)
- Go/No-Go: GO/NO-GO
```

---

## Test 4: Large File Attachment (100MB image) (5 دقائق)

**الهدف**: اختبار Composer + attachment handling + limits

**الخطوات**:
1. افتح http://localhost:3000/chat/conv_seed_001
2. في Composer، اضغط Paperclip → حاول رفع:
   - ملف صغير (1KB txt) → يجب أن ينجح
   - صورة 5MB → يجب أن ينجح أو يظهر progress
   - ملف 100MB (أنشئ dummy: `dd if=/dev/zero of=/tmp/large.bin bs=1M count=100`)
3. تحقق من Network: `POST /conversations/:id/messages` مع attachment
4. تحقق من Message: هل يظهر attachment name + type؟

**المتوقع**:
- ✓ ملف 1KB ينجح
- ✓ صورة 5MB تنجح مع preview
- ✓ ملف 100MB: إما يرفض برسالة واضحة أو chunked upload (مقبول)
- ✓ لا يسبب crash للـ Backend أو SSE

**الفشل**:
- ✗ Backend crash عند 100MB → No-Go → أضف limit + validation
- ✗ SSE يتوقف بعد رفع كبير → No-Go → تحقق من backpressure queue

**التسجيل**:
```
Test 4: Large Attachment - PASS/FAIL
- 1KB: PASS/FAIL
- 5MB image: PASS/FAIL
- 100MB: Rejected with message / Chunked / Crash (GO/NO-GO)
- Backend still healthy: YES/NO (GET /health)
- SSE still working: YES/NO
- Go/No-Go: GO/NO-GO
```

---

## Test 5: E2E Path الكامل (8 دقائق)

**الهدف**: المسار الحقيقي الذي يحدد Go/No-Go للنشر

```
Create conversation
        ↓
Send message + attachment
        ↓
Receive streamed event (SSE)
        ↓
Create mission (Planner)
        ↓
Planner creates steps
        ↓
Tool executes (Browser, Files, Memory)
        ↓
Approval appears (External action)
        ↓
Approve
        ↓
Mission resumes
        ↓
Memory written (vector search)
        ↓
Artifact created (report.md, provenance.json)
        ↓
Evidence recorded
        ↓
Conversation reloads after restart (persistence)
```

**الخطوات**:
1. `POST /api/v1/conversations` → احفظ `conversationId`
2. `POST /api/v1/conversations/:id/messages` مع `content: "أنشئ مهمة لبناء Skill جديدة" + attachment`
3. تابع SSE: `GET /api/v1/events/stream` → هل `message.created` وصل؟
4. `POST /api/v1/missions` مع goal من الرسالة
5. `POST /api/v1/missions/:id/start` → تابع `mission.step.started` عبر SSE
6. انتظر حتى يظهر Approval: `GET /api/v1/approvals` → هل `apr_xxx` موجود؟
7. `POST /api/v1/missions/:id/approve` مع approvalId
8. تحقق `GET /api/v1/memory/search?q=Skill` → هل memory جديدة؟
9. `GET /api/v1/missions/:id/artifacts` → هل artifacts موجودة؟
10. `GET /api/v1/evidence` → هل evidence chain valid؟
11. أعد تشغيل Backend (Ctrl+C → `npx tsx ...`) → `GET /api/v1/conversations/:id` → هل المحادثة لا تزال؟

**المتوقع**: كل خطوة PASS

**الفشل في أي خطوة = No-Go**

**التسجيل**:
```
Test 5: Full E2E Path - PASS/FAIL
1. Create conversation: PASS/FAIL (id: xxx)
2. Send message + SSE: PASS/FAIL (latency: Xms)
3. Create mission: PASS/FAIL (id: xxx)
4. Planner steps: PASS/FAIL (X steps)
5. Tool executes: PASS/FAIL (X tool calls)
6. Approval appears: PASS/FAIL (id: apr_xxx)
7. Approve: PASS/FAIL
8. Mission resumes: PASS/FAIL (status: running/completed)
9. Memory written: PASS/FAIL (search found X)
10. Artifact created: PASS/FAIL (X artifacts)
11. Evidence recorded: PASS/FAIL (chain valid)
12. Reload persistence: PASS/FAIL (conversation still exists)

Go/No-Go: GO/NO-GO
Reason if No-Go: ...
```

---

## Decision Gate - Go/No-Go

بعد الـ 5 اختبارات، أرسل:

```
Test 1 SSE Reconnect: PASS/FAIL
Test 2 Persistence: PASS/FAIL
Test 3 Multi-agent: PASS/FAIL
Test 4 Large Attachment: PASS/FAIL
Test 5 Full E2E Path: PASS/FAIL

Overall: GO (جاهز للنشر) / NO-GO (يحتاج إصلاح)

If NO-GO, failures:
- Test X: reason + logs
- e2e-results.log
- sse-stats.json
```

**GO Criteria**: 5/5 PASS أو 4/5 PASS مع Test 5 PASS إجباري

**NO-GO Criteria**: Test 5 FAIL أو 2+ tests FAIL

---

## الملفات المطلوبة لـ Option 2

```bash
node scripts/e2e-celiaos-test.js > /tmp/e2e-results.log
curl http://localhost:3001/api/v1/sse/stats > /tmp/sse-stats.json
curl http://localhost:3001/api/v1/runtime/health > /tmp/health.json
curl http://localhost:3001/api/v1/tools > /tmp/tools.json

# أرسل:
# - e2e-results.log (10 checks)
# - sse-stats.json (health baseline)
# - health.json
# - أي 3 أخطاء من الـ 5 tests
```

---

## التشغيل السريع (Copy-Paste)

```bash
git checkout arena/01a0a9e0-12pro
npm install

# Terminal 1
npx tsx services/api-server/src/index.ts

# Terminal 2
cd apps/web && npm run dev

# Terminal 3
node scripts/e2e-celiaos-test.js
node scripts/load-test-sse.js --clients=50 --messages=10

# ثم اتبع الـ 5 tests أعلاه
```

---

**المدة**: 25-40 دقيقة
**النتيجة**: Go/No-Go decision واضح
**التالي**: إذا GO → جاهز للنشر، إذا NO-GO → أصلح وأعد الاختبار
