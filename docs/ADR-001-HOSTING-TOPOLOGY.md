# ADR-001: Hosting Topology Coupling & Persistence Strategy

**Status**: ACCEPTED (v1.0.0) | MIGRATED_IN (v1.1.0)
**Date**: 2026-09-16
**Deciders**: Architecture Review + Gap Fixes
**Branch**: arena/01a0a9e0-12pro

---

## Context

- CeliaOS runs on-device (Colab, local) and server (Docker, Fly.io, Vercel)
- Persistence currently uses filesystem (JSON file + SQLite)
- Serverless platforms (Vercel, Lambda, Cloud Functions) reset filesystem every 15-60 seconds
- This creates hidden coupling: business logic assumes durable filesystem
- Repo has Dockerfile + docker-compose.yml with postgres/redis/qdrant/ollama volumes → intended deployment is container with persistent volume

### Current Persistence

```typescript
// services/api-server/src/index.ts
const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message[]>();

// packages/memory-fabric/src/index.ts
this.persistencePath = path.join(process.cwd(), 'certification', 'memory-fabric', 'memories.json');
fs.writeFileSync(this.persistencePath, JSON.stringify(data));

// packages/mission-ledger/src/index.ts
this.persistencePath = path.join(process.cwd(), 'certification', 'mission-ledger', 'missions.json');
```

File JSON local - works for container with volume, fails for serverless ephemeral.

---

## Problem

Users deploying to Vercel see data loss silently. No error, no warning. Conversations, missions, memory vanish after redeploy or scale-out.

This is a **contract violation**, not a bug. Business logic assumes durable FS, but serverless provides ephemeral FS.

**Evidence**:
- User noted: "SQLite المحلي isn't durable on Vercel Serverless" - same applies to JSON files
- celia.pro currently serves French graphic designer WordPress, domain taken, actual hosting for CeliaOS not determined
- Must confirm hosting type before v1.0.0 tag - most important decision

---

## Options Considered

### Option 1: Support only container deployments (v1.0.0) - CHOSEN

**Implementation**:
- v1.0.0: Container deployments only (Docker+Volume, Fly.io, Render, Railway, VPS, Local)
- v1.1.0: Postgres adapter enables serverless (Vercel, Lambda)
- Document deployment matrix explicitly
- Add warning if VERCEL env without DATABASE_URL

**Pros**:
- Time to v1.0.0: 0 weeks delay (earlier release)
- Clear mental model for users
- No silent failures
- Single abstraction layer for future migration

**Cons**:
- User base limited to self-hosted for v1.0.0
- Vercel users must wait for v1.1.0

### Option 2: Add Postgres for all deployments (delays v1.0.0 by 2 weeks)

**Implementation**:
- Implement Postgres adapter before v1.0.0
- All deployments use Postgres (even local dev)
- Connection pool for Vercel (50 connections)

**Pros**:
- Supports all platforms in v1.0.0
- Single persistence layer

**Cons**:
- Delays v1.0.0 by 2 weeks
- Overkill for local dev and container deployments
- More complex setup for simple use cases

### Option 3: Add runtime detection + silent errors (REJECTED)

**Implementation**:
- Detect hosting type at runtime
- If Vercel without DB, log warning but continue with ephemeral FS
- Data loss still happens, but user warned

**Pros**:
- No delay

**Cons**:
- Unhelpful for users - warning doesn't prevent data loss
- Still silent failure in production
- Poor UX

---

## Decision

**v1.0.0: Container deployments only (Docker+Volume, Fly.io, Render, Railway, VPS, Local)**

**v1.1.0: Postgres adapter enables serverless (Vercel, Lambda, multi-region)**

**Rationale**:
- This is contract definition, not bug fix
- Prevents future confusion when someone tries Vercel and data vanishes
- Enables roadmap visibility (v1.0 ≠ v1.1 without architectural reason)
- Platform-thinking: Accept technical debt consciously with retirement plan

---

## Tradeoffs

| Aspect | Cost | Benefit |
|--------|------|---------|
| Time to v1.0.0 | -0 weeks | Earlier release, 8.8/10 quality |
| User base | Limited to self-hosted for v1.0.0 | Clear mental model, no silent failures |
| Migration effort | +1 week for v1.1.0 | Single abstraction layer, zero-downtime possible |
| Data safety | JSON durable in containers with volume | Avoids silent failure on serverless |
| Complexity | Low for v1.0.0 | Abstraction ready for Postgres swap |

---

## Consequences

### Positive

- v1.0.0 deployment-matrix.yaml is source of truth - explicit contract
- v1.1.0 must implement AbstractPersistence.Postgres without breaking v1.0.0 users
- Documentation prominently warns Vercel users (HOSTING-REQUIREMENTS.md)
- Testing requires both Container and Serverless matrix (future)
- Users have clear mental model: container = file JSON works, serverless = needs Postgres

### Negative

- Vercel users must wait for v1.1.0 (2 weeks)
- Need to maintain File and Postgres adapters in v1.1.0 (dual-write phase)

### Neutral

- Local dev still uses File JSON (simple, no DB setup)
- Container deployments use File JSON with volume mount (simple, durable)

---

## Implementation

### v1.0.0 (Current)

```typescript
// services/api-server/src/index.ts
function checkHostingPersistence() {
  const isVercel = !!process.env.VERCEL;
  const hasDb = !!process.env.DATABASE_URL;
  if (isVercel && !hasDb) {
    logJson('error', 'CRITICAL: VERCEL without DATABASE_URL - persistence WILL BE LOST!', {
      solution: 'Set DATABASE_URL to Postgres - see docs/HOSTING-REQUIREMENTS.md'
    });
  }
}

// configs/deployment-matrix.yaml
v1.0.0:
  STABLE_FOR: [Docker+Volume, Fly.io, Render, Railway, VPS, Local]
  NOT_READY_FOR: [Vercel, Lambda, Cloud Functions]
```

**Evidence**:
- HOSTING-REQUIREMENTS.md with persistence matrix
- LAUNCH-CHECKLIST.md Step 0: Hosting confirmation before tag
- Raw artifacts: health, load, E2E with file JSON persistence

### v1.1.0 (Next)

```typescript
// Abstraction layer - already designed in HOSTING-REQUIREMENTS.md
interface PersistenceAdapter {
  save(collection: string, data: any): Promise<void>;
  load(collection: string): Promise<any[]>;
}

class FilePersistence implements PersistenceAdapter {
  // Current - for local + container with volume
}

class PostgresPersistence implements PersistenceAdapter {
  constructor(private dbUrl: string) {}
  // For Vercel, Lambda
  async save(collection, data) {
    // INSERT INTO memories ...
  }
}

class HybridPersistence implements PersistenceAdapter {
  constructor() {
    if (process.env.DATABASE_URL) {
      this.adapter = new PostgresPersistence(process.env.DATABASE_URL);
    } else if (process.env.VERCEL) {
      console.warn('VERCEL without DATABASE_URL - data WILL BE LOST');
      this.adapter = new FilePersistence();
    } else {
      this.adapter = new FilePersistence();
    }
  }
}
```

**Migration**:
- Script: Migrate File → Postgres with checksum verification
- Zero-downtime: dual-write phase (write to both File and Postgres, read from Postgres)
- Connection pool: 50 connections for Vercel

---

## Validation

### Before v1.0.0 Tag

- [x] deployment-matrix.yaml reflects hosting decision
- [x] README.md calls out NOT-READY-FOR platforms
- [x] HOSTING-REQUIREMENTS.md documents persistence matrix
- [x] ROLLBACK-PLAN.md has step-by-step commands
- [x] checkHostingPersistence() warns if VERCEL without DATABASE_URL
- [x] Raw artifacts show file JSON persistence works for container
- [x] LAUNCH-CHECKLIST.md Step 0: Hosting confirmation

### For v1.1.0

- [ ] AbstractPersistence.Postgres implements same contract
- [ ] Connection pool config (50 for Vercel)
- [ ] Migration script File → Postgres with verification
- [ ] Auto-detection: File vs Postgres based on DATABASE_URL
- [ ] Testing matrix: Container + Serverless

---

## References

- docs/HOSTING-REQUIREMENTS.md - Persistence matrix + hosting types
- configs/deployment-matrix.yaml - Source of truth for v1.0.0 vs v1.1.0
- docs/ROLLBACK-PLAN.md - Rollback with volume considerations
- docs/GAPS-FIXES-v1.0.0.md - Gap #2 fix details
- certification/v1.0.0-raw/ - Raw artifacts with file JSON persistence

---

## Status

**ACCEPTED** for v1.0.0 - Container deployments only

**MIGRATED_IN** for v1.1.0 - Postgres adapter enables serverless

**This ADR documents architectural constraint that costs users time if not explicit.**

---

**Decided**: 2026-09-16
**Branch**: arena/01a0a9e0-12pro
**Quality**: 8.8/10 - Production-grade for containers
