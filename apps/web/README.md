# CeliaOS / Nawah Web Agent Interface

> واجهة Agent OS كاملة - ليست مجرد Chat، بل Control Plane للنظام

## نظرة عامة

```
┌──────────────────────────────────────────────────────────────┐
│ CeliaOS / Nawah                              ⌘K   ⚙   👤    │
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│ + New Chat    │               MAIN WORKSPACE                 │
│               │                                              │
│ Conversations │  User: ابحث عن ...                           │
│  Today        │                                              │
│  Yesterday    │  ┌────────────────────────────────────────┐  │
│               │  │ Agent Mission                          │  │
│ Projects      │  │ ✓ Understand                           │  │
│ Missions      │  │ ✓ Plan                                 │  │
│ Skills        │  │ ● Act → Browser                        │  │
│ Connectors    │  │ ○ Observe                              │  │
│ Memory        │  │ ○ Reflect                              │  │
│               │  └────────────────────────────────────────┘  │
│               │                                              │
│               │  Tool Activity                               │
│               │  Browser → Search → GitHub → Files           │
│               │                                              │
│               │  ─────────────────────────────────────────   │
│               │  اكتب رسالتك...                [🎤] [↑]      │
└───────────────┴──────────────────────────────────────────────┘
```

## البنية

```
Browser
   ↓
Next.js UI (apps/web)
   ↓
REST + SSE (/api/v1)
   ↓
12pro Runtime (services/api-server)
   ↓
Mission Ledger, Memory Fabric, Tool Registry, Governance, Evidence
   ↓
Intelligence Fabric (Ollama primary, Gemini fallback, $0)
```

## الصفحات

- `/` - Command Center (Home)
- `/chat` - Conversations list
- `/chat/[conversationId]` - Chat + Mission Cockpit + Tool Activity
- `/missions` - Missions list
- `/missions/[missionId]` - Mission detail (Plan Timeline, Artifacts, Evidence)
- `/projects` - Projects
- `/skills` - Skills registry
- `/memory` - Memory Fabric (Working, Episodic, Semantic, Procedural, Meta)
- `/connectors` - Connectors (GitHub, Gmail, Drive, Calendar)
- `/tools` - Tools (14/16)
- `/artifacts` - Artifacts (report.md, changed-files/, provenance.json)
- `/approvals` - Approval Center (Risk levels, Approve/Reject)
- `/trust` - Trust Dashboard (Governance PASS, Evidence VERIFIED)
- `/developer` - Developer Console (Runtime Health, Logs, Events, API)
- `/settings` - Settings (Providers, Runtime, Security, Appearance, BYOK)

## المكونات

```
components/
├── shell/ (AppShell, Sidebar, TopBar, CommandPalette)
├── chat/ (ChatView, MessageList, Message, Composer, StreamingMessage)
├── agent/ (MissionCard, PlanTimeline, ToolActivity, ApprovalRequest, AgentModeSelector)
├── memory/ (MemoryExplorer, MemorySearch, MemoryTypeBadge)
├── trust/ (TrustDashboard, RiskBadge, EvidencePanel, ProvenanceViewer)
├── developer/ (RuntimeHealth, LogsViewer, EventStream, ApiExplorer)
├── artifacts/ (ArtifactBrowser, ArtifactPreview)
└── ui/ (Button, Card, Badge - shadcn-like)
```

## State Management

```
store/
├── chat.store.ts (Zustand)
├── mission.store.ts
├── runtime.store.ts
├── memory.store.ts
├── approval.store.ts
└── ui.store.ts (theme dark, language ar, agentMode)

Flow:
REST → API Client → Store → React UI
SSE → Event Normalizer → Store → React UI
```

## REST Contract

```
Conversations:
POST   /api/v1/conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/:id
PATCH  /api/v1/conversations/:id
DELETE /api/v1/conversations/:id

Messages:
POST /api/v1/conversations/:id/messages
GET  /api/v1/conversations/:id/messages

Streaming:
GET /api/v1/events/stream (SSE)

Missions:
POST   /api/v1/missions
GET    /api/v1/missions
GET    /api/v1/missions/:id
POST   /api/v1/missions/:id/start|pause|resume|stop|approve|reject
GET    /api/v1/missions/:id/events
GET    /api/v1/missions/:id/artifacts

Tools/Skills:
GET  /api/v1/tools
GET  /api/v1/skills
GET  /api/v1/mcp/servers

Memory:
GET  /api/v1/memory/search?q=&type=&limit=
GET  /api/v1/memory/stats

Runtime/Trust:
GET  /api/v1/runtime/health (REAL, not hardcoded)
GET  /api/v1/evidence
GET  /api/v1/providers
GET  /api/v1/governance
GET  /api/v1/approvals
GET  /api/v1/identity
```

## Intelligence Fabric

```
                Intelligence Fabric
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   Model Router    Task Router       Cost Guard
       │               │                │
       └───────────────┼────────────────┘
                       │
                 Provider Router
                       │
       ┌────────┬──────┼──────┬────────┐
       ▼        ▼      ▼      ▼        ▼
    Ollama   Gemini  NVIDIA  Groq     HF
       │
       ▼
     $0 core
```

- **Ollama**: Primary, local, unlimited free
- **Gemini**: Free fallback, 1M context, 1500 req/day
- **NVIDIA**: Optional, DGX Cloud
- **Groq**: Optional, fast
- **HF**: Specialized (embeddings, classification, $0.10 quota)

**Budget Guard**: MAX_SPEND=0, blockPaid, blockUnknownCost, dailyQuota

## التشغيل

```bash
# Backend
cd services/api-server
npm run dev # 0.0.0.0:3001

# Frontend
cd apps/web
npm install
npm run dev # 0.0.0.0:3000 → rewrites to :3001

# Tests
npm run test:unit # intelligence-fabric tests (9 PASS)
```

## معيار الإنجاز E2E

```
Create conversation → Send message → Receive streamed event → Create mission → Planner creates steps → Tool executes → Approval appears → Approve → Mission resumes → Memory written → Artifact created → Evidence recorded → Conversation reloads after restart
```

## المميزات

- Streaming حقيقي مع SSE
- Mission timeline مع حالة كل خطوة
- Human-in-the-loop Approval Center
- Artifact panel
- Memory interface مع vector search حقيقي (cosine similarity + persistence)
- Agent state (Autonomy 80%, Runtime HEALTHY, Tools 14/16)
- Trust Dashboard مع evidence حقيقية (ليس hardcoded PASS)
- Developer Console مع logs, events, API explorer
- Provider Center مع health check حقيقي
- Arabic-first RTL مع LTR للكود

## القاعدة الذهبية

> لا Mock UI — كل حالة من مصدر حقيقي: Mission Ledger, Memory Fabric, Tool Registry, SSE, Governance, Evidence

---

Built as CeliaOS Control Plane, not just Chat. Original design, same functional category as Claude/Manus but not copying assets.
