# AGI-OS / Agent OS - 12-Layer Professional Repository

> **GitHub ليس مجرد مكان للكود؛ الـRepository هو مركز دورة التطوير والاختبار والأمان والنشر والتوثيق والإثبات.**

هذا المستودع يطبّق **12 طبقة احترافية متكاملة** لتحويل GitHub من مجرد Git server إلى **سجل إثبات وبيئة عمل للوكيل (Agent Workspace)**.

---

## 📊 12 طبقة رئيسية

| الطبقة | المكونات الأساسية | الوظيفة | المسار |
|--------|-------------------|---------|--------|
| **1. Source Code** | `apps/`, `packages/`, `src/`, `services/` | كود النظام | `apps/`, `packages/`, `services/` |
| **2. Tests** | `unit/`, `integration/`, `e2e/`, `stress/`, `security/` | إثبات أن النظام يعمل | `tests/` |
| **3. CI/CD** | `.github/workflows/` | Build / Test / Lint / Deploy | `.github/workflows/` |
| **4. GitHub Automation** | Actions, Webhooks, Bots | أتمتة العمليات | `.github/` |
| **5. Issues** | Bugs / Features / Tasks | إدارة العمل | `.github/ISSUE_TEMPLATE/` |
| **6. Pull Requests** | Review / Approval / Merge | مراجعة التغييرات | `.github/PULL_REQUEST_TEMPLATE.md` |
| **7. Releases** | Tags / Changelog / Artifacts | إصدارات موثقة | `CHANGELOG.md`, Releases |
| **8. Security** | Dependabot / CodeQL / Secret scanning | حماية المستودع | `.github/dependabot.yml`, `SECURITY.md` |
| **9. Documentation** | `README`, `/docs`, API docs, architecture | توثيق النظام | `docs/` |
| **10. Configuration** | `.env.example`, configs, schemas | إعدادات التشغيل | `configs/`, `.env.example` |
| **11. Packages & Artifacts** | GitHub Packages / binaries / Docker | توزيع المكونات | `package.json` workspaces, GHCR |
| **12. Governance & Evidence** | ADRs / RFCs / benchmarks / certification | إثبات القرارات والنتائج | `certification/`, `docs/adr/`, `docs/rfc/` |

---

## 🏗️ هيكل Repository

```text
agi-system/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml          # Lint, Typecheck, Unit, Build, G0-G3
│   │   ├── test.yml        # Integration, Contract, Regression
│   │   ├── e2e.yml         # E2E, Browser, Long-Horizon, Acceptance
│   │   ├── security.yml    # Audit, CodeQL, Secrets, Container scan
│   │   ├── benchmark.yml   # Latency, Memory, Planning, Tool-use
│   │   ├── release.yml     # Version, Changelog, Publish, Certification
│   │   └── deploy.yml      # Staging / Production
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   ├── feature.yml
│   │   └── task.yml
│   ├── PULL_REQUEST_TEMPLATE.md  # 12-layer checklist + Gates
│   ├── CODEOWNERS          # حماية حسب الطبقات
│   └── dependabot.yml
│
├── apps/
│   ├── web/                # Product Layer: Web UI
│   ├── api/                # Product Layer: REST API
│   └── agent-ui/           # Product Layer: Agent observability UI
│
├── packages/               # Agent Runtime Layer
│   ├── agent-core/         # Agent, Mission, Task primitives
│   ├── runtime/            # Deterministic executor
│   ├── planner/            # Hierarchical planner DAG
│   ├── orchestrator/       # Coordinates planner+runtime+memory
│   ├── swarm/              # Multi-agent consensus
│   ├── memory/             # Vector + episodic + semantic
│   ├── skills/             # Composable capabilities
│   ├── tools/              # Tool registry + validation
│   ├── browser/            # Playwright grounding
│   ├── sandbox/            # gVisor isolation
│   ├── governance/         # Policy engine, spend limits
│   ├── security/           # Secret scanning, validation
│   ├── providers/          # LLM routing Gemini/Groq/Ollama
│   ├── observability/      # OTEL tracing
│   └── evaluation/         # Benchmark harness
│
├── services/               # Service Layer
│   ├── api-server/         # Production API with governance
│   ├── worker/             # Long-horizon mission worker
│   ├── scheduler/          # Cron missions
│   └── webhook/            # GitHub -> AGI Runtime bridge
│
├── tests/                  # Verification Layer
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── e2e/
│   ├── regression/
│   ├── stress/
│   ├── chaos/
│   ├── security/
│   ├── browser/
│   └── acceptance/
│
├── benchmarks/             # Evidence Layer
│   ├── latency/
│   ├── memory/
│   ├── planning/
│   ├── tool-use/
│   └── long-horizon/
│
├── docs/
│   ├── architecture/       # 12-layer diagram + data flow
│   ├── api/                # OpenAPI
│   ├── adr/                # 7 ADRs: why decisions
│   │   ├── 0001-typescript-core.md
│   │   ├── 0002-memory-architecture.md
│   │   ├── 0003-provider-routing.md
│   │   ├── 0004-sandbox-model.md
│   │   ├── 0005-zero-cost-policy.md
│   │   ├── 0006-rest-api.md
│   │   └── 0007-agent-runtime.md
│   ├── rfc/                # Future big features
│   │   ├── autonomous-missions.md
│   │   ├── browser-agent.md
│   │   ├── multi-agent-swarm.md
│   │   └── self-healing.md
│   ├── operations/
│   ├── security/
│   ├── testing/
│   └── deployment/
│
├── configs/
│   ├── development/
│   ├── test/
│   └── production/
│
├── scripts/
│   ├── build/              # deploy.js
│   ├── test/               # run-all.js
│   ├── benchmark/          # aggregate.js, compare.js
│   ├── release/            # prepare.js, changelog.js
│   └── verification/       # verify-gates.js, generate-certification.js
│
├── certification/          # Evidence / Certification Layer
│   ├── gates/
│   │   ├── G0.json .. G13.json  # كل Gate: status, commit, tests
│   ├── reports/
│   │   ├── unit.json, integration.json, e2e.json, security.json
│   ├── benchmarks/
│   │   └── latest.json
│   └── manifests/
│       └── release.json
│
├── examples/               # Usage examples
├── migrations/             # DB migrations
├── .env.example            # Zero-cost template, no real secrets
├── package.json            # Monorepo workspaces + scripts
├── tsconfig.json           # Base + references
└── README.md
```

---

## 🔄 دورة العمل GitHub كبيئة للوكيل

```text
Idea
 ↓
Issue (bug.yml / feature.yml / task.yml)
 ↓
Task
 ↓
Branch (feat/planner-dag)
 ↓
Pull Request (12-layer checklist)
 ↓
CI (ci.yml -> test.yml -> security.yml -> benchmark.yml)
 ↓
Certification (G0-G13 JSON)
 ↓
Review (CODEOWNERS: @runtime-team, @security-team)
 ↓
Merge (blocked if required gate FAIL)
 ↓
Release (Tag + SHA + Artifacts + CHANGELOG + Certification Report)
 ↓
Packages (npm @agi-system/* + Docker ghcr.io)
 ↓
Deploy (staging auto, production on tag)
 ↓
Monitoring / Feedback -> Issue / Improvement
```

### PR Gates (لا يتم Merge عند فشل Gate إلزامي)

```text
Lint       ✅  ci.yml
Typecheck  ✅  ci.yml
Unit       ✅  ci.yml
Integration✅  test.yml
E2E        ✅  e2e.yml
Security   ✅  security.yml
Build      ✅  ci.yml
Benchmark  ℹ️  benchmark.yml (info, fails if regression >10%)
```

---

## 🤖 GitHub كـ Agent Workspace

```text
GitHub
   │
   ├── Push
   ├── Pull Request
   ├── Issue
   ├── Release
   └── Workflow
          │
          ▼
     Webhook (services/webhook)
          │
          ▼
    AGI Runtime (packages/runtime + orchestrator)
          │
          ├── analyze
          ├── plan
          ├── test
          ├── review
          └── report
                │
                ▼
         PR Comment / Issue Update / Certification
```

**الوكيل لا يعمل خارج GitHub؛ GitHub هو بيئة عمله.**

---

## 🧪 طبقة الاختبار - ليست مجرد `npm test`

```text
Unit
  ↓
Integration
  ↓
Contract
  ↓
E2E
  ↓
Security
  ↓
Stress (100 concurrent missions)
  ↓
Chaos (provider failure -> fallback)
  ↓
Long-Horizon (10-step missions)
  ↓
Acceptance
```

كل مستوى مرتبط بـ Gate يمنع الـMerge.

---

## 📜 Evidence / Certification - إثبات قابل للتدقيق

بدلاً من `"All tests passed"`، نحتفظ بدليل:

```json
{
  "gate": "G13",
  "status": "PASS",
  "commit": "abc123",
  "timestamp": "2026-09-16T07:00:00Z",
  "tests": 60,
  "passed": 60,
  "failed": 0,
  "artifacts": ["certification/reports/e2e.json"]
}
```

موجود في `certification/gates/`, `reports/`, `benchmarks/`, `manifests/`.

كل Release مرتبط بـ:

```text
Git Tag + Commit SHA + Tests + Artifacts + CHANGELOG + Certification Report
```

مثال Release:

```text
v1.5.0
├── Source
├── Docker image ghcr.io/...:v1.5.0
├── npm @agi-system/* packages
├── benchmark-report.json
└── certification.json
```

---

## 🔐 إدارة الأسرار - Zero-Cost Policy

**لا تضع أبداً:**

```env
GEMINI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

داخل repository.

الصحيح:

- `.env.example` فارغ (موجود)
- مفاتيح حقيقية في `GitHub Actions Secrets` وبيئة النشر
- `MAX_SPEND=0` افتراضياً -> يستخدم Ollama local
- CI يمر بدون مفاتيح مدفوعة

```bash
cp .env.example .env
# fill locally, never commit
```

---

## 🚀 البدء السريع

```bash
# 1. Install
npm ci

# 2. Build all packages
npm run build

# 3. Lint + Typecheck + Unit
npm run lint
npm run typecheck
npm run test:unit

# 4. Full verification (gates)
npm run verify

# 5. Benchmarks
npm run benchmark

# 6. Generate certification
npm run certify

# 7. Dev
npm run dev
```

### متطلبات

- Node >=20, npm >=10
- للاختبارات المتكاملة: Postgres, Redis, Qdrant (via docker-compose مستقبلاً)
- للـE2E: `npx playwright install`

---

## 📦 Packages

عند النشر:

```text
@agi-system/core
@agi-system/runtime
@agi-system/memory
@agi-system/planner
@agi-system/sdk
@agi-system/cli
```

كـ npm packages + Docker images `ghcr.io/sayedelazameydesign-crypto/12pro`.

---

## 🛡️ CODEOWNERS والسياسات

```text
/packages/security/     @security-team
/packages/runtime/      @runtime-team
/packages/governance/   @governance-team
/certification/         @governance-team @qa-team (no bypass)
```

Branch Protection لـ `main`:

- PR required
- CI required
- Review required (CODEOWNERS)
- No force push
- Signed commits recommended

---

## 📚 ADR / RFC - لماذا وليس فقط ماذا

- `docs/adr/` : قرارات معمارية (7 موجودة)
- `docs/rfc/` : ميزات كبيرة مستقبلية (4 موجودة)

مثال ADR: `0005-zero-cost-policy.md` يشرح لماذا `MAX_SPEND=0`.

---

## 🎯 5 مستويات مترابطة لـ AGI-OS

```text
1. Product
   Web / API / CLI (apps/)

2. Agent Runtime
   Planner / Executor / Memory / Skills / Tools / Governance (packages/)

3. Verification
   Unit / Integration / E2E / Stress / Security / Long-Horizon (tests/, benchmarks/)

4. GitHub Engineering
   PR / Issues / Actions / Releases / Packages / Security (.github/)

5. Evidence
   Gates / Benchmarks / Reports / Commit SHA / Artifacts (certification/)
```

الفرق الجوهري عن repo يحتوي فقط `src + tests` هو أن **العلاقة بين الطبقات قابلة للتنفيذ والتحقق**: `CI → Tests → Certification → Release` ليست ملفات شكلية بل Gates تمنع Merge.

---

## 📈 Certification Gates

| Gate | Name | Required | Blocking | Status |
|------|------|----------|----------|--------|
| G0 | Build & Lint & Typecheck | ✅ | ✅ | PASS |
| G1 | Unit | ✅ | ✅ | PASS |
| G2 | Integration | ✅ | ✅ | PASS |
| G3 | Security | ✅ | ✅ | PASS |
| G4 | Contract | ✅ | ✅ | PASS |
| G5 | E2E | ✅ | ✅ | PASS |
| G6 | Stress | ✅ | ✅ | PASS |
| G7 | Chaos | ✅ | ✅ | PASS |
| G8 | Benchmarks | ✅ | ❌ | PASS |
| G9 | Acceptance | ✅ | ❌ | PASS |
| G10 | Governance | ❌ | ❌ | PASS |
| G11 | Docs | ❌ | ❌ | PASS |
| G12 | Release Readiness | ❌ | ❌ | PASS |
| G13 | Long-Horizon | ❌ | ❌ | PASS |

See `certification/gates/` for JSON evidence.

---

## 🔗 روابط

- Architecture: `docs/architecture/README.md`
- Testing: `docs/testing/README.md`
- Security: `SECURITY.md`, `docs/security/`
- Contributing: `CONTRIBUTING.md`
- Changelog: `CHANGELOG.md`
- Certification: `certification/manifests/latest.json`

---

## 📄 License

MIT - See `LICENSE`

---

**Repository متكامل = Code + Tests + CI/CD + Security + Issues/PR + Releases + Packages + Documentation + Evidence + Automation**

الأهم ليس عدد المجلدات، بل أن تكون العلاقة بينها **قابلة للتنفيذ والتحقق**.
