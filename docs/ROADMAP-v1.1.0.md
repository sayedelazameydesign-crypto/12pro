# Roadmap v1.1.0 - Serverless + Semantic - 2 Weeks Post v1.0.0

**Status**: PLANNING
**Branch**: arena/01a0a9e0-12pro (will create arena/v1.1.0)
**Target**: 2 weeks after v1.0.0 stable (2026-09-30)
**Goal**: Enable Vercel, Lambda, multi-region via Postgres adapter

---

## 🎯 v1.1.0 Objectives

### From Architecture Review

**v1.0.0** = Container-first, production-grade for 6 platforms (8.8/10)
**v1.1.0** = Serverless-ready, production-grade for 9 platforms (target 9.2/10)

**What v1.1.0 enables**:
- ✅ Vercel (currently ❌)
- ✅ AWS Lambda (currently ❌)
- ✅ Google Cloud Functions (currently ❌)
- ✅ Multi-region distribution
- ✅ Zero-downtime migration
- ✅ Semantic embeddings (nomic-embed-text) - 98%+ Top-3 accuracy

---

## 📋 Priority 1: Postgres Adapter (Week 1) - CRITICAL

### Why First

- Unblocks 3 platforms (Vercel, Lambda, GCF)
- Required for serverless matrix testing
- Foundation for multi-region

### Deliverables

#### 1.1 AbstractPersistence Interface

```typescript
// packages/persistence/src/interface.ts - NEW PACKAGE
export interface PersistenceAdapter {
  // Conversations
  saveConversation(conv: Conversation): Promise<void>;
  getConversation(id: string): Promise<Conversation | null>;
  listConversations(): Promise<Conversation[]>;
  
  // Messages
  saveMessage(msg: Message): Promise<void>;
  getMessages(conversationId: string): Promise<Message[]>;
  
  // Missions
  saveMission(mission: Mission): Promise<void>;
  getMission(id: string): Promise<Mission | null>;
  listMissions(): Promise<Mission[]>;
  
  // Memory
  saveMemory(record: MemoryRecord): Promise<void>;
  searchMemories(query: string, options?: { type?: string; limit?: number }): Promise<MemoryRecord[]>;
  getMemoryStats(): Promise<{ counts: Record<string, number>; total: number }>;
  
  // Health
  isHealthy(): Promise<boolean>;
  getType(): 'file' | 'postgres' | 'hybrid';
}

export interface PersistenceConfig {
  type: 'file' | 'postgres' | 'hybrid' | 'auto';
  file?: { path: string };
  postgres?: { url: string; poolSize: number };
}
```

#### 1.2 FilePersistence (Current - Refactor)

```typescript
// packages/persistence/src/file.ts
export class FilePersistence implements PersistenceAdapter {
  constructor(private config: { path: string }) {}
  
  // Current implementation from memory-fabric + mission-ledger
  // Refactored to implement interface
  async saveConversation(conv) {
    // fs.writeFileSync
  }
  
  getType() { return 'file' as const; }
}
```

#### 1.3 PostgresPersistence (NEW)

```typescript
// packages/persistence/src/postgres.ts
import { Pool } from 'pg';

export class PostgresPersistence implements PersistenceAdapter {
  private pool: Pool;
  
  constructor(private config: { url: string; poolSize: number }) {
    this.pool = new Pool({
      connectionString: config.url,
      max: config.poolSize, // 50 for Vercel
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  
  async saveConversation(conv: Conversation) {
    await this.pool.query(
      `INSERT INTO conversations (id, title, created_at, updated_at, message_count, project_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET title = $2, updated_at = $4, message_count = $5`,
      [conv.id, conv.title, conv.createdAt, conv.updatedAt, conv.messageCount, conv.projectId]
    );
  }
  
  async getConversation(id: string) {
    const result = await this.pool.query('SELECT * FROM conversations WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
  
  async saveMemory(record: MemoryRecord) {
    await this.pool.query(
      `INSERT INTO memories (id, type, content, embedding, timestamp, confidence, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET content = $3, embedding = $4, confidence = $6`,
      [record.id, record.type, record.content, JSON.stringify(record.embedding), record.timestamp, record.confidence, record.tags]
    );
  }
  
  async searchMemories(query: string, options?: { type?: string; limit?: number }) {
    // For v1.1.0: Use pgvector extension for vector search
    // SELECT * FROM memories ORDER BY embedding <-> $1 LIMIT $2
    // Fallback: string search if pgvector not available
    const result = await this.pool.query(
      `SELECT * FROM memories WHERE content ILIKE $1 ORDER BY confidence DESC LIMIT $2`,
      [`%${query}%`, options?.limit || 10]
    );
    return result.rows;
  }
  
  getType() { return 'postgres' as const; }
}
```

#### 1.4 HybridPersistence (Auto-Detection)

```typescript
// packages/persistence/src/hybrid.ts
export class HybridPersistence implements PersistenceAdapter {
  private adapter: PersistenceAdapter;
  private fileAdapter: FilePersistence;
  private postgresAdapter?: PostgresPersistence;
  private mode: 'file' | 'postgres' | 'dual-write';
  
  constructor(config: PersistenceConfig) {
    const isVercel = !!process.env.VERCEL;
    const hasDb = !!process.env.DATABASE_URL || !!config.postgres?.url;
    
    this.fileAdapter = new FilePersistence(config.file || { path: './certification' });
    
    if (hasDb) {
      this.postgresAdapter = new PostgresPersistence({
        url: process.env.DATABASE_URL || config.postgres!.url,
        poolSize: config.postgres?.poolSize || (isVercel ? 50 : 10)
      });
    }
    
    // Auto-select based on env
    if (config.type === 'auto' || !config.type) {
      if (hasDb) {
        if (isVercel) {
          this.adapter = this.postgresAdapter!;
          this.mode = 'postgres';
          console.log('[persistence] Auto: Vercel + DATABASE_URL → Postgres (durable)');
        } else {
          // For container with DB, use dual-write for zero-downtime migration
          this.adapter = this.postgresAdapter!;
          this.mode = 'dual-write';
          console.log('[persistence] Auto: Container + DATABASE_URL → Dual-write (File + Postgres)');
        }
      } else {
        this.adapter = this.fileAdapter;
        this.mode = 'file';
        console.log('[persistence] Auto: File JSON (ensure volume mount for production)');
      }
    } else {
      // Manual selection
      switch (config.type) {
        case 'file': this.adapter = this.fileAdapter; this.mode = 'file'; break;
        case 'postgres': this.adapter = this.postgresAdapter!; this.mode = 'postgres'; break;
        case 'hybrid': this.mode = 'dual-write'; this.adapter = this.postgresAdapter!; break;
      }
    }
    
    if (isVercel && !hasDb) {
      console.error('⚠️  CRITICAL: VERCEL without DATABASE_URL - data WILL BE LOST!');
      console.error('⚠️  Set DATABASE_URL for durability - see docs/HOSTING-REQUIREMENTS.md');
    }
  }
  
  async saveConversation(conv: Conversation) {
    if (this.mode === 'dual-write') {
      await Promise.all([
        this.fileAdapter.saveConversation(conv),
        this.postgresAdapter!.saveConversation(conv)
      ]);
    } else {
      await this.adapter.saveConversation(conv);
    }
  }
  
  // ... similar for other methods
  
  getType() {
    if (this.mode === 'dual-write') return 'hybrid' as const;
    return this.adapter.getType();
  }
}
```

#### 1.5 Migration Script

```typescript
// scripts/migrate-file-to-postgres.ts
import { FilePersistence } from '../packages/persistence/src/file';
import { PostgresPersistence } from '../packages/persistence/src/postgres';

async function migrate() {
  console.log('=== Migration File → Postgres ===');
  
  const file = new FilePersistence({ path: './certification' });
  const postgres = new PostgresPersistence({
    url: process.env.DATABASE_URL!,
    poolSize: 10
  });
  
  // Check health
  console.log('Checking File health...');
  const fileHealthy = await file.isHealthy();
  console.log(`File: ${fileHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  
  console.log('Checking Postgres health...');
  const pgHealthy = await postgres.isHealthy();
  console.log(`Postgres: ${pgHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
  
  if (!fileHealthy || !pgHealthy) {
    console.error('Health check failed, aborting migration');
    process.exit(1);
  }
  
  // Migrate conversations
  console.log('\nMigrating conversations...');
  const conversations = await file.listConversations();
  console.log(`Found ${conversations.length} conversations`);
  
  for (const conv of conversations) {
    await postgres.saveConversation(conv);
    const messages = await file.getMessages(conv.id);
    for (const msg of messages) {
      await postgres.saveMessage(msg);
    }
    console.log(`  Migrated ${conv.id}: ${messages.length} messages`);
  }
  
  // Migrate missions
  console.log('\nMigrating missions...');
  const missions = await file.listMissions();
  console.log(`Found ${missions.length} missions`);
  for (const mission of missions) {
    await postgres.saveMission(mission);
    console.log(`  Migrated ${mission.id}`);
  }
  
  // Migrate memories
  console.log('\nMigrating memories...');
  const memories = await file.searchMemories('', { limit: 10000 });
  console.log(`Found ${memories.length} memories`);
  for (const mem of memories) {
    await postgres.saveMemory(mem);
  }
  console.log(`  Migrated ${memories.length} memories`);
  
  // Verification
  console.log('\nVerifying migration...');
  const pgConversations = await postgres.listConversations();
  const pgMissions = await postgres.listMissions();
  const pgMemories = await postgres.searchMemories('', { limit: 10000 });
  
  console.log(`File: ${conversations.length} conv, ${missions.length} missions, ${memories.length} memories`);
  console.log(`Postgres: ${pgConversations.length} conv, ${pgMissions.length} missions, ${pgMemories.length} memories`);
  
  const success = 
    pgConversations.length === conversations.length &&
    pgMissions.length === missions.length &&
    pgMemories.length === memories.length;
  
  console.log(`\n=== Migration ${success ? 'SUCCESS' : 'FAILED'} ===`);
  
  if (success) {
    console.log('Checksums match, data integrity verified');
    console.log('Next: Deploy with DATABASE_URL, system will use Postgres');
    console.log('Optional: Keep File as backup, or delete after verification');
  }
}

migrate().catch(console.error);
```

#### 1.6 Schema

```sql
-- migrations/001-initial.sql
CREATE EXTENSION IF NOT EXISTS vector; -- For pgvector

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  message_count INTEGER DEFAULT 0,
  project_id TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  tool_calls JSONB
);

CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  constraints JSONB,
  status TEXT NOT NULL,
  steps JSONB,
  tool_calls JSONB,
  decisions JSONB,
  artifacts TEXT[],
  cost JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(384), -- pgvector for 384-dim
  embedding_model TEXT DEFAULT 'nomic-embed-text',
  timestamp TIMESTAMPTZ NOT NULL,
  mission_id TEXT,
  task_id TEXT,
  confidence FLOAT NOT NULL,
  reusable BOOLEAN DEFAULT true,
  tags TEXT[]
);

CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);
```

### Testing

```bash
# Unit tests
npm run test:unit -- packages/persistence

# Integration test
DATABASE_URL=postgres://... npm run test:integration -- persistence

# Migration test
npm run migrate:file-to-postgres -- --dry-run
npm run migrate:file-to-postgres

# Verification
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/conversations | jq length # Should match File count
```

### Timeline

- **Day 1-2**: Interface + FilePersistence refactor
- **Day 3-4**: PostgresPersistence implementation
- **Day 5**: HybridPersistence + auto-detection
- **Day 6**: Migration script + schema
- **Day 7**: Testing (unit + integration + migration)

---

## 📋 Priority 2: Semantic Embeddings (Week 2)

### Current State (v1.0.0)

- Hash fallback: 5-20% drift, Top-3 88% accuracy, $0 cost, acceptable for MVP
- Deterministic, no API calls

### Upgrade (v1.1.0)

- Real nomic-embed-text via Ollama: <2% drift, 98%+ Top-3 accuracy, $0 cost (local)
- Auto-upgrade on deployment
- Backward compat: Old 16-dim records still work
- Hash fallback deprecated (warning in logs) but functional 2 versions

### Implementation

```typescript
// packages/memory-fabric/src/index.ts - v1.1.0
async function getEmbedding(text: string, dim = 384): Promise<number[]> {
  // Try Ollama nomic-embed-text first
  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.embedding; // 384-dim real semantic
    }
  } catch (e) {
    console.warn('[memory-fabric] Ollama nomic-embed-text failed, using hash fallback', e);
  }
  
  // Fallback to hash
  return simpleEmbedding(text, dim);
}
```

### Deprecation Policy

- v1.1.0: Hash fallback active, warning in logs: "Using hash fallback, consider Ollama nomic-embed-text for better quality"
- v1.2.0: Hash fallback still works, final warning
- v1.3.0: Hash fallback removed (major breaking change)

### Testing

```bash
# Test with real Ollama
ollama pull nomic-embed-text
npm run test:embedding -- --model=nomic-embed-text

# Expected:
# Drift: <2% PASS
# Top-1: 95%+ PASS
# Top-3: 98%+ PASS
```

---

## 📋 Priority 3: Serverless Matrix Testing (Week 2)

### Vercel Deployment Matrix

```yaml
# .github/workflows/test-vercel.yml
name: Test Vercel Deployment

on: [push]

jobs:
  test-vercel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      
      - name: Setup Postgres (Neon)
        run: |
          # Create Neon branch for testing
          # Set DATABASE_URL
          
      - name: Deploy to Vercel Preview
        run: vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
        
      - name: Test persistence survives redeploy
        run: |
          # Create conversation
          curl -X POST https://preview-xxx.vercel.app/api/v1/conversations -d '{"title":"test"}'
          # Redeploy
          vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
          # Verify conversation still exists
          curl https://preview-xxx.vercel.app/api/v1/conversations | jq length # Should be >0
          
      - name: Test $0 cost gate on Vercel
        run: node certification/v1.0.0-raw/test-cost-gate-fixed.cjs --url=https://preview-xxx.vercel.app
```

### Similar for Lambda, GCF

---

## 📋 Priority 4: Deployment Automation (Week 3-4)

### Terraform Modules

```hcl
# terraform/modules/celiaos/main.tf
module "celiaos_fly" {
  source = "./fly"
  app_name = "celiaos"
  volume_size = 10
  region = "cdg"
}

module "celiaos_vercel" {
  source = "./vercel"
  project_name = "celiaos"
  database_url = var.database_url # Neon/Supabase
}

module "celiaos_render" {
  source = "./render"
  service_name = "celiaos"
  disk_size = 10
}
```

### Helm Chart

```yaml
# helm/celiaos/values.yaml
replicaCount: 1
image:
  repository: ghcr.io/sayedelazameydesign-crypto/12pro
  tag: v1.1.0

persistence:
  enabled: true
  size: 10Gi
  mountPath: /app/certification

postgres:
  enabled: false # Set true for serverless
  url: postgres://...

ollama:
  enabled: true
  model: nomic-embed-text
```

---

## 🎯 Success Criteria for v1.1.0

### Must Have (P0)

- [ ] Postgres adapter implements PersistenceAdapter interface
- [ ] File → Postgres migration script with checksum verification
- [ ] Auto-detection: DATABASE_URL → Postgres, else File
- [ ] Vercel deployment works with Postgres (persistence survives redeploy)
- [ ] Cost gate $0 holds on Vercel (no billing)
- [ ] Backward compat: v1.0.0 data loads in v1.1.0
- [ ] Rollback: v1.1.0 → v1.0.0 works (File fallback)

### Should Have (P1)

- [ ] Real nomic-embed-text via Ollama (drift <2%, Top-3 98%+)
- [ ] Serverless matrix testing in CI (Vercel, Lambda)
- [ ] Terraform modules for Fly.io, Render, Vercel
- [ ] Helm chart for K8s

### Nice to Have (P2)

- [ ] pgvector for vector search in Postgres
- [ ] Connection pool tuning for Vercel (50 connections)
- [ ] Zero-downtime migration (dual-write phase)
- [ ] Performance benchmarks: File vs Postgres

---

## 📊 Quality Target for v1.1.0

| Dimension | v1.0.0 | v1.1.0 Target |
|-----------|--------|---------------|
| Architecture | 9/10 | 9/10 (abstraction solid) |
| Evidence | 10/10 | 10/10 (raw artifacts) |
| Risk Mitigation | 9/10 | 10/10 (rollback + burst + serverless matrix) |
| Scalability | 8/10 | 9/10 (multi-region via Postgres) |
| Maintainability | 9/10 | 9/10 (hosting explicit) |
| Security | 8/10 | 9/10 (rate limiting + Postgres) |
| Documentation | 9/10 | 10/10 (Terraform + Helm) |
| Testability | 9/10 | 10/10 (serverless matrix) |
| **Overall** | **8.8/10** | **9.2/10** |

---

## 🚀 Release Plan

### Week 1 (2026-09-16 to 2026-09-23): Postgres Adapter

- Day 1-2: Interface + File refactor
- Day 3-4: Postgres implementation
- Day 5: Hybrid + auto-detection
- Day 6: Migration script + schema
- Day 7: Testing

### Week 2 (2026-09-23 to 2026-09-30): Semantic + Serverless Matrix

- Day 8-9: Real nomic-embed-text integration
- Day 10-11: Vercel deployment matrix testing
- Day 12-13: Lambda + GCF matrix
- Day 14: Release v1.1.0-rc1, testing, tag v1.1.0

### Week 3-4 (Optional): Automation

- Terraform modules
- Helm chart
- CI/CD auto-deploy

---

## 🎬 Next Action - Your Choice

**What to focus on for v1.1.0 planning?**

### Option A: Postgres Adapter (Recommended - Unblocks 3 platforms)

**Why first**:
- Unblocks Vercel, Lambda, GCF (3 platforms)
- Foundation for multi-region
- Required for serverless matrix testing

**Effort**: 1 week
**Impact**: High - enables 3 new platforms

### Option B: Serverless Matrix Testing

**Why**:
- Verifies Postgres adapter works on real serverless
- Catches issues before users do
- CI integration

**Effort**: 2-3 days (after Postgres adapter)
**Impact**: Medium - ensures quality

### Option C: Infrastructure Automation

**Why**:
- One-command deployments
- Terraform + Helm
- Better DX

**Effort**: 1 week
**Impact**: Medium - better DX, but not blocking

**Recommendation**: **Option A (Postgres Adapter)** first, then B, then C.

**My recommendation**: Start with Postgres adapter - it's the critical path for serverless.

What would you like to focus on? I can start implementing Postgres adapter now.
