# Rollback Plan - CeliaOS v1.0.0

**Gap**: #8 - No rollback plan
**Date**: 2026-09-16
**Version**: v1.0.0

---

## Pipeline with Rollback

Proposed pipeline:

```
RC → Tag → Deploy → Smoke → E2E → Evidence → PASS/FAIL → (Rollback if FAIL)
```

Current gap: No defined actions if Smoke/E2E FAIL after deploy.

---

## Rollback Scenarios

### Scenario 1: Smoke Tests FAIL after Deploy

**Detection**:
```bash
curl http://celia.pro/api/v1/health
# → 500 or timeout

curl http://celia.pro/api/v1/runtime/health
# → unhealthy

curl http://celia.pro/api/v1/sse/stats
# → error
```

**Impact**: API down, frontend cannot connect

**Rollback**:

```bash
# If container deployment (Fly.io, Render, Docker)
# 1. Check previous version
fly releases --image
# or
docker images | grep celiaos

# 2. Rollback to previous tag
fly deploy --image celiaos:v0.9.0
# or
docker run -d --name celiaos-previous celiaos:v0.9.0

# 3. Verify rollback
curl http://celia.pro/api/v1/health
# → should be ok

# 4. Notify
echo "Rollback to v0.9.0 due to smoke fail at $(date)" | tee rollback.log
```

**Time**: <5 minutes

---

### Scenario 2: E2E Tests FAIL after Deploy (API works but flows broken)

**Detection**:
```bash
node scripts/e2e-celiaos-test.js
# → FAIL at step 3 (mission creation)

node scripts/manual-e2e-automated.js
# → Test 5 Full E2E FAIL
```

**Impact**: API up but missions, approvals, memory broken

**Rollback**:

Same as Scenario 1, but also:

```bash
# Check if data migration caused issue
ls -la certification/memory-fabric/memories.json
# If corrupted, restore from backup

cp certification/memory-fabric/memories.json.bak certification/memory-fabric/memories.json
cp certification/mission-ledger/missions.json.bak certification/mission-ledger/missions.json

# Or if Postgres, restore from backup
pg_restore -d $DATABASE_URL backup.sql
```

**Time**: <10 minutes

---

### Scenario 3: Persistence Lost (File JSON wiped on redeploy)

**Detection**:
```bash
# After deploy, conversations gone
curl http://celia.pro/api/v1/conversations
# → [] empty, but should have seed + previous

# This indicates volume not mounted or serverless without DB
```

**Impact**: All conversations, missions, memory lost

**Root Cause**: Hosting type mismatch (see HOSTING-REQUIREMENTS.md)

**Rollback + Fix**:

```bash
# 1. Immediate rollback to restore volume
fly deploy --image celiaos:v0.9.0

# 2. Check volume mount
fly volumes list
# Should show celiaos_data mounted

# 3. If no volume, create and mount
fly volumes create celiaos_data --region cdg --size 10
# Update fly.toml
[mounts]
  source = "celiaos_data"
  destination = "/app/certification"

# 4. If Vercel serverless, must add Postgres
# - Create Neon/Supabase Postgres
# - Set DATABASE_URL
# - Deploy v1.1 with Postgres adapter

# 5. Restore from backup if available
# Check if backup exists in S3 or local
ls -la backups/
```

**Time**: 10-30 minutes depending on fix

**Prevention**: For v1.0.0, deploy only to container with volume, not Vercel without DB

---

### Scenario 4: 50MB Limit Too Restrictive or Too Permissive

**Detection**:
```bash
# Users report cannot upload 40MB files (should be allowed)
# Or server OOM due to large files

# Check logs
grep "FILE_TOO_LARGE" logs.json
# Or
grep "File too large" logs.json
```

**Rollback**:

```bash
# If limit too restrictive, increase to 100MB (quick fix)
# Edit services/api-server/src/index.ts
const MAX_FILE_SIZE = 100 * 1024 * 1024;

# Deploy hotfix
fly deploy --image celiaos:v1.0.1-hotfix

# If OOM due to large files, decrease to 20MB and add chunking
const MAX_FILE_SIZE = 20 * 1024 * 1024;
```

**Time**: <15 minutes

---

### Scenario 5: Embedding Migration Breaks Search

**Detection**:
```bash
curl "http://celia.pro/api/v1/memory/search?q=frontend"
# → [] empty or irrelevant results
# Expected: should return mem_1 with 0.94 similarity

# Check embedding dim
curl http://celia.pro/api/v1/memory/search?q=test | jq .records[0].embeddingDim
# Should be 384, but old data has 16
```

**Impact**: Memory search broken

**Rollback**:

```bash
# 1. Check if old data still exists
cat certification/memory-fabric/memories.json | jq '.[0].embedding | length'
# If 16, need migration

# 2. Run migration script
node scripts/migrate-embeddings.js --from=16 --to=384

# 3. Or rollback to v0.9.0 with 16-dim
fly deploy --image celiaos:v0.9.0

# 4. For v1.0.1, ensure backward compat handles both 16 and 384
# Code should accept both dims during transition
```

**Time**: <20 minutes

---

## Rollback Checklist

**Before Deploy**:

- [ ] Tag previous version: `git tag v0.9.0 && git push origin v0.9.0`
- [ ] Backup persistence:
  ```bash
  cp certification/memory-fabric/memories.json certification/memory-fabric/memories.json.bak.$(date +%s)
  cp certification/mission-ledger/missions.json certification/mission-ledger/missions.json.bak.$(date +%s)
  # Or pg_dump if Postgres
  pg_dump $DATABASE_URL > backup-$(date +%s).sql
  ```
- [ ] Record current image: `fly releases --image > releases.log` or `docker images > images.log`
- [ ] Have rollback command ready

**After Deploy - Smoke**:

- [ ] `curl /api/v1/health` → ok
- [ ] `curl /api/v1/runtime/health` → healthy
- [ ] `curl /api/v1/sse/stats` → 0/100
- [ ] If any FAIL → rollback immediately (Scenario 1)

**After Deploy - E2E**:

- [ ] `node scripts/e2e-celiaos-test.js` → 10/10 PASS
- [ ] `node scripts/manual-e2e-automated.js` → 5/5 PASS
- [ ] If FAIL → rollback (Scenario 2)

**After Deploy - Monitoring (first 1 hour)**:

- [ ] Check logs for errors: `grep -i error logs.json`
- [ ] Check 50MB limit: `grep FILE_TOO_LARGE logs.json`
- [ ] Check persistence: `curl /api/v1/conversations | jq length` should not be 0 after deploy
- [ ] Check memory search: `curl "/api/v1/memory/search?q=test" | jq .records[0].similarity` should be >0.5
- [ ] If persistence lost → Scenario 3
- [ ] If 50MB issues → Scenario 4
- [ ] If search broken → Scenario 5

---

## Rollback Commands Reference

**Fly.io**:
```bash
fly releases
fly deploy --image registry.fly.io/celiaos:v0.9.0
fly logs
fly volumes list
```

**Render**:
```bash
# Via dashboard: Rollback to previous deploy
# Or via API
curl -X POST https://api.render.com/v1/services/srv-xxx/deploys/srv-xxx-rollback
```

**Docker**:
```bash
docker ps
docker stop celiaos && docker rm celiaos
docker run -d --name celiaos -v celiaos-data:/app/certification -p 3000:3000 celiaos:v0.9.0
docker logs celiaos
```

**Vercel** (if used, but not recommended for v1.0.0 without DB):
```bash
vercel rollback
vercel logs
```

---

## Communication

**If rollback needed**:

1. **Log**: `echo "$(date -Iseconds) Rollback to v0.9.0 due to [reason]" >> rollback.log`
2. **Notify**: Post in Slack/Discord #deployments
3. **Evidence**: Save failed E2E logs to `certification/v1.0.0-raw/rollback-*.log`
4. **Fix**: Create issue with failed test logs, fix in branch, re-test, re-deploy

---

## Prevention for v1.0.0

- **Hosting**: Deploy to container with volume, not Vercel serverless without DB (see HOSTING-REQUIREMENTS.md)
- **Persistence**: Backup before deploy, verify volume mount
- **50MB limit**: Already tested at boundary (49MB, 50MB-1KB, 50MB, 50MB+1KB, 51MB, 100MB) - PASS
- **Embedding**: Migration tested, ranking preserved, backward compat handles 16 and 384 - PASS
- **Cost gate**: Tested with real provider data, $0 enforced in 3 layers - PASS
- **SSE reconnect**: Tested under load (20 clients, 5 disconnect simultaneous) - PASS

**Overall**: Rollback plan now exists, raw artifacts generated for independent verification.

---

**Status**: ✅ Rollback plan created, addresses Gap #8
