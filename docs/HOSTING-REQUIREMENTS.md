# Hosting Requirements - Critical Persistence Analysis

**Date**: 2026-09-16
**Gap**: #2 - Persistence = file JSON local, not DB
**Severity**: 🔴 CRITICAL - Structural blocker if serverless

---

## Problem Statement

Current implementation:

```typescript
// services/api-server/src/index.ts
const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message[]>();
// + file JSON in certification/memory-fabric/memories.json

// packages/memory-fabric/src/index.ts
this.persistencePath = path.join(process.cwd(), 'certification', 'memory-fabric', 'memories.json');
// fs.writeFileSync

// packages/mission-ledger/src/index.ts
this.persistencePath = path.join(process.cwd(), 'certification', 'mission-ledger', 'missions.json');
```

**This is local filesystem persistence.**

### Why this fails on serverless:

- **Vercel Serverless Functions**: Ephemeral filesystem, no persistence between invocations, redeploy wipes disk
- **AWS Lambda**: /tmp is ephemeral, 512MB limit, cleared after invocation
- **Cloudflare Workers**: No filesystem at all
- **Netlify Functions**: Same as Vercel

**Evidence**: User noted earlier "SQLite المحلي isn't durable on Vercel Serverless" - same applies to JSON files.

### celia.pro analysis:

- https://celia.pro currently serves a French graphic designer site (WordPress), not our app
- Domain is taken, but for our project it's placeholder
- Actual hosting type for CeliaOS deployment is **NOT YET DETERMINED**
- Must confirm before tag v1.0.0

---

## Intended Deployment (from repo)

**Dockerfile + docker-compose.yml exist**:

```dockerfile
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/...
EXPOSE 3000
CMD ["node", "dist/services/api-server/src/index.js"]
```

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
  redis:
    image: redis:7
  qdrant:
    image: qdrant/qdrant:latest
  ollama:
    image: ollama/ollama:latest
    volumes: ["ollama:/root/.ollama"]  # Persistent volume
  api-server:
    build: .
    depends_on: [postgres, redis, qdrant]
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://redis:6379
      VECTOR_DB_URL: http://qdrant:6333
```

**This indicates intended deployment is container-based with persistent volumes, NOT Vercel serverless.**

---

## Hosting Types & Persistence Matrix

| Hosting | Filesystem | SQLite | JSON File | Postgres | Redis | Qdrant | Suitable? |
|---------|------------|--------|-----------|----------|-------|--------|-----------|
| **Local dev** | ✅ Persistent | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Yes |
| **Docker + Volume** | ✅ With volume | ✅ With volume | ✅ With volume | ✅ | ✅ | ✅ | ✅ Yes - RECOMMENDED |
| **Fly.io / Render / Railway** | ✅ With volume | ✅ With volume | ✅ With volume | ✅ | ✅ | ✅ | ✅ Yes |
| **Vercel Serverless** | ❌ Ephemeral | ❌ Not durable | ❌ Not durable | ✅ (external) | ✅ (external) | ✅ (external) | ⚠️ Only with external DB |
| **AWS Lambda** | ❌ /tmp ephemeral | ❌ | ❌ | ✅ | ✅ | ✅ | ⚠️ Only with external DB |
| **K8s with PVC** | ✅ With PVC | ✅ With PVC | ✅ With PVC | ✅ | ✅ | ✅ | ✅ Yes |

---

## Solution: Persistence Abstraction

### Current (v1.0.0 - local dev + container)

```typescript
// File JSON persistence - works for:
// - Local dev (npm run dev)
// - Docker with volume mount: -v ./data:/app/certification
// - Fly.io / Render with persistent disk

class MemoryFabric {
  constructor(options?: { persistencePath?: string }) {
    this.persistencePath = options?.persistencePath || 
      process.env.PERSISTENCE_PATH ||
      path.join(process.cwd(), 'certification', 'memory-fabric', 'memories.json');
  }
}
```

**Requirement**: Must mount volume for persistence.

```bash
# Docker
docker run -v celiaos-data:/app/certification -p 3000:3000 celiaos

# docker-compose (already has volumes for ollama, needs for api-server)
volumes:
  - celiaos-data:/app/certification
  - ollama:/root/.ollama

# Fly.io
fly volumes create celiaos_data --region cdg --size 10
# fly.toml
[mounts]
  source = "celiaos_data"
  destination = "/app/certification"
```

### Future (v1.1 - production with external DB)

```typescript
// Abstraction that checks env
interface PersistenceAdapter {
  save(collection: string, data: any): Promise<void>;
  load(collection: string): Promise<any[]>;
}

class FilePersistence implements PersistenceAdapter {
  // Current implementation - for local + container with volume
}

class PostgresPersistence implements PersistenceAdapter {
  constructor(private dbUrl: string) {}
  // For Vercel, Lambda, or any serverless
  async save(collection, data) {
    // INSERT INTO memories ...
  }
}

class HybridPersistence implements PersistenceAdapter {
  constructor() {
    if (process.env.DATABASE_URL) {
      this.adapter = new PostgresPersistence(process.env.DATABASE_URL);
      console.log('[persistence] Using Postgres (DATABASE_URL set) - durable for serverless');
    } else if (process.env.VERCEL) {
      console.warn('[persistence] ⚠️ VERCEL env detected but no DATABASE_URL - persistence WILL BE LOST on redeploy!');
      console.warn('[persistence] Set DATABASE_URL to Postgres for durability');
      this.adapter = new FilePersistence();
    } else {
      this.adapter = new FilePersistence();
      console.log('[persistence] Using File JSON - ensure volume mount for production');
    }
  }
}
```

---

## Deployment Checklist - Hosting Type Confirmation

**BEFORE tagging v1.0.0, confirm**:

- [ ] **Where will celia.pro be hosted?**
  - [ ] Option A: Docker container with volume (Fly.io, Render, Railway, K8s) → **Current file JSON works if volume mounted** ✅
  - [ ] Option B: Vercel Serverless → **Must add DATABASE_URL Postgres, current file JSON will FAIL** ❌
  - [ ] Option C: Self-hosted VPS with Docker → **Current works with volume** ✅

- [ ] **If container with volume**:
  ```bash
  # Verify volume mount
  docker volume ls | grep celiaos
  # Or check fly.toml mounts
  # Or check render.yaml disks
  ```

- [ ] **If Vercel/serverless**:
  ```bash
  # Must implement Postgres adapter before launch
  # 1. Create Postgres (Neon, Supabase, Railway)
  # 2. Set DATABASE_URL env
  # 3. Run migrations
  # 4. Test persistence survives redeploy
  ```

- [ ] **Test persistence survives restart** (already tested in Manual E2E Test 2):
  ```bash
  # Current test: localStorage.clear() + reload → file JSON still exists
  # But this does NOT test container redeploy or serverless cold start
  # Need additional test:
  docker-compose down && docker-compose up -d
  curl http://localhost:3001/api/v1/conversations | jq length
  # Should still have conversations
  ```

---

## Recommendation

**For v1.0.0**:

1. **Document hosting requirement**: Container with persistent volume (not Vercel serverless without DB)
2. **Add warning in code**: If VERCEL env detected without DATABASE_URL, log warning
3. **Update docs**: Clearly state file JSON is for local dev + container, not for serverless
4. **For v1.1**: Implement Postgres adapter for serverless support

**Current status**:

- ✅ Works for local dev
- ✅ Works for Docker with volume (intended from docker-compose.yml)
- ❌ Will NOT work for Vercel serverless without external DB (structural failure, not just untested)

**This is more important than push order** - if celia.pro will be Vercel, persistence PASS is invalid for production regardless of smoke test.

---

## Evidence

- Raw artifacts show persistence via file JSON works for reload (Test 2 PASS)
- But reload is browser reload, not container redeploy or serverless cold start
- Dockerfile + docker-compose.yml indicate intended deployment is container, not serverless
- Need to confirm actual hosting for celia.pro before tag

---

## Action Items

- [x] Create this doc (HOSTING-REQUIREMENTS.md)
- [ ] Add warning in api-server if VERCEL env without DATABASE_URL
- [ ] Update LAUNCH-CHECKLIST.md with hosting type confirmation step
- [ ] For v1.0.0: Deploy to container with volume (Fly.io/Render) - file JSON works
- [ ] For v1.1: Implement Postgres adapter for Vercel support

**Decision**: For v1.0.0, deploy as container with persistent volume. File JSON persistence is valid for that hosting type. Document that Vercel serverless requires external DB.
