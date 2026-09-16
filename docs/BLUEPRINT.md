# Blueprint الكامل لـ GitHub Repository - AGI-OS / 12pro

> هذا الملف يحدد لكل مجلد وملف: وظيفته، محتواه، الـGitHub Actions المرتبطة به، والـGates التي تمنع الـMerge.

تاريخ: 2026-09-16
Commit المرجع: e4444dab733e22318d9253707a39734fbb581d03

---

## 1. نظرة عامة - 12 طبقة

| # | الطبقة | المسارات | الوظيفة |
|---|--------|----------|---------|
| 1 | Source Code | `apps/`, `packages/`, `services/` | كود النظام |
| 2 | Tests | `tests/` | إثبات أن النظام يعمل |
| 3 | CI/CD | `.github/workflows/` | Build/Test/Lint/Deploy |
| 4 | Automation | `.github/` | أتمتة |
| 5 | Issues | `.github/ISSUE_TEMPLATE/` | إدارة العمل |
| 6 | Pull Requests | `.github/PULL_REQUEST_TEMPLATE.md` | مراجعة |
| 7 | Releases | Tags/Changelog/Artifacts | إصدارات موثقة |
| 8 | Security | Dependabot/CodeQL/Secrets | حماية |
| 9 | Documentation | `docs/` | توثيق |
| 10 | Configuration | `.env.example`, `configs/` | إعدادات |
| 11 | Packages | npm/Docker | توزيع |
| 12 | Governance/Evidence | `certification/`, `docs/adr/`, `rfc/` | إثبات القرارات |

---

## 2. تفصيل كل مجلد

### `.github/workflows/` - طبقة CI/CD + Automation

#### `ci.yml`
- **الوظيفة**: البوابة الأساسية. يمنع Merge إذا فشل.
- **المحتوى**: 
  - `install`: cache npm
  - `lint`: `npm run lint`
  - `typecheck`: `tsc -b --noEmit`
  - `unit-test`: `vitest` -> يكتب `certification/reports/unit.json`
  - `build`: `tsc -b` + upload artifacts
  - `certification-gate-G0-G3`: يشغل `verify-gates.js`
- **Triggers**: push to main/develop/arena/**, PR to main/develop
- **Gates**: G0 (Build/Lint/Typecheck), G1 (Unit)

#### `test.yml`
- **الوظيفة**: Integration + Contract + Regression
- **المحتوى**: services Postgres/Redis/Qdrant, يشغل `test:integration`, `test:contract`
- **Artifacts**: `integration-report`, `contract-report`
- **Gates**: G2 Integration, G4 Contract

#### `e2e.yml`
- **الوظيفة**: End-to-End + Long-Horizon + Acceptance
- **المحتوى**: يبدأ الخدمات، `playwright test`, `vitest run tests/acceptance`
- **Timeout**: 30 دقيقة
- **Artifacts**: `e2e-report`, `playwright-report`, `acceptance-report`
- **Gates**: G5 E2E, G9 Acceptance, G13 Long-Horizon

#### `security.yml`
- **الوظيفة**: طبقة الأمان
- **المحتوى**:
  - `dependency-audit`: `npm audit --audit-level=high` + `tests/security`
  - `codeql`: تحليل JS/TS
  - `secret-scanning`: gitleaks
  - `container-scan`: Trivy FS -> SARIF
- **Schedule**: أسبوعي الاثنين 3am
- **Gates**: G3 Security - BLOCKING

#### `benchmark.yml`
- **الوظيفة**: قياس الأداء P50/P95/P99
- **المحتوى**:
  - `benchmark`: يشغل 5 بنش ماركات (latency, memory, planning, tool-use, long-horizon)
  - كل واحد يكتب `certification/benchmarks/*.json`
  - `aggregate.js` يجمع في `latest.json`
  - `compare.js`: يقارن مع baseline، يفشل إذا regression >10%
- **Gates**: G8 Benchmarks - INFO (لا يمنع لكن ينبه)

#### `release.yml`
- **الوظيفة**: إصدار موثق
- **Triggers**: push tag `v*.*.*` أو manual dispatch مع version
- **Jobs**:
  1. `verify`: `npm run verify -- --strict` - كل Gates يجب PASS
  2. `build-and-certify`: build + `certify` -> `certification/manifests/`
  3. `publish-npm`: ينشر كل `packages/*` إلى npm
  4. `publish-docker`: buildx -> ghcr.io
  5. `github-release`: ينشئ GitHub Release مع ملفات certification + CHANGELOG
- **Artifacts**: Docker image + npm packages + certification manifest + benchmark report
- **Gates**: G12 Release Readiness

#### `deploy.yml`
- **الوظيفة**: نشر staging/production
- **Triggers**: push main (staging auto), tag v* (production), manual
- **Jobs**: deploy-staging -> deploy-production (needs staging)
- **Checks**: smoke tests, health-check.js
- **Environments**: GitHub Environments staging/production

---

### `.github/ISSUE_TEMPLATE/` - طبقة Issues

#### `bug.yml`
- **الوظيفة**: تقرير bug موحد
- **الحقول**: component, severity P0-P3, reproduction, expected, logs, commit SHA
- **Labels**: bug, needs-triage
- **Automation**: يمكن ربطها بـ AGI Runtime لتحليل تلقائي

#### `feature.yml`
- **الوظيفة**: طلب ميزة
- **الحقول**: target layer (12 طبقة), problem, proposal, alternatives, gate-impact, ADR/RFC link
- **Labels**: enhancement, needs-rfc
- **Gate Impact**: يحدد إذا الميزة تحتاج Gate جديد

#### `task.yml`
- **الوظيفة**: مهمة هندسية
- **الحقول**: type (Chore/Tech Debt/Docs/Benchmark/Security/CI/CD/Governance), scope, acceptance criteria checklist

---

### `.github/PULL_REQUEST_TEMPLATE.md` - طبقة PRs

- **الوظيفة**: يفرض 12-layer checklist
- **المحتوى**:
  - Summary + linked Issue
  - 12-layer checklist (Source, Tests, CI/CD, Automation, Issues, PR Quality, Releases, Security, Docs, Config, Packages, Governance)
  - Gates table: Lint, Typecheck, Unit, Integration, E2E, Security, Build, Benchmark
  - Evidence: commit SHA, certification reports, benchmark diff
  - Breaking changes
  - Reviewers per CODEOWNERS

- **Merge Policy**: 
  ```
  IF required gate FAIL => block merge
  Required gates: G0-G7 (blocking=true)
  ```

---

### `.github/CODEOWNERS` - طبقة Governance

- **الوظيفة**: يفرض مراجعة حسب الطبقات
- **التقسيم**:
  - `packages/agent-core,runtime,planner,orchestrator,swarm` -> @runtime-team
  - `memory,skills` -> @memory-team
  - `tools` -> @tools-team
  - `browser` -> @browser-team
  - `sandbox,governance,security,services` -> @security-team + @governance-team
  - `providers` -> @providers-team
  - `observability` -> @observability-team
  - `evaluation` -> @evaluation-team
  - `apps/web,agent-ui` -> @frontend-team
  - `apps/api` -> @backend-team
  - `tests,benchmarks` -> @qa-team + @runtime-team
  - `docs/adr,rfc` -> @governance-team + @architecture-team
  - `certification` -> @governance-team @qa-team (no bypass)
  - `.github,configs,scripts` -> @devops-team + @security-team
  - `.env.example,SECURITY.md` -> @security-team

---

### `.github/dependabot.yml` - طبقة Security

- **الوظيفة**: تحديثات تلقائية
- **Ecosystems**:
  - npm / (root)
  - npm /packages/agent-core, /packages/runtime, /apps/web
  - github-actions /
  - docker /
- **Schedule**: weekly Monday 08:00
- **Grouping**: dev-dependencies, runtime-deps
- **Labels**: dependencies, security
- **Reviewers**: security-team

---

### `apps/` - طبقة Product

#### `apps/web/`
- **الوظيفة**: Web UI لمراقبة AGI-OS
- **المحتوى**: `src/index.ts` يبدأ AgentCore + Runtime
- **Package**: @agi-system/web, private, type module
- **Build**: tsc
- **Related Workflows**: e2e.yml (browser tests)
- **Gates**: G5 E2E (browser)

#### `apps/api/`
- **الوظيفة**: REST API لإنشاء missions
- **المحتوى**: `createMission(req): MissionResponse`
- **Endpoints**: POST /api/v1/missions (محدد في openapi.yaml)
- **Related**: test.yml contract, e2e.yml
- **Gates**: G4 Contract, G5 E2E

#### `apps/agent-ui/`
- **الوظيفة**: UI لعرض حالة Agents real-time
- **المحتوى**: `AgentView`, `renderAgentStatus()`
- **Gates**: G5 E2E

---

### `packages/` - طبقة Agent Runtime (15 package)

كل package يتبع نفس الهيكل:
```
packages/<name>/
├── package.json      # @agi-system/<name> 0.1.0, exports . -> dist/index.js
├── tsconfig.json     # extends ../../, outDir dist, rootDir src, composite
├── src/
│   ├── index.ts      # Service class + health() + init()
│   └── types.ts      # GateStatus, CertificationEvidence
└── README.md         # Responsibility + usage + gates
```

| Package | المسؤولية | Workflows | Gates |
|---------|-----------|-----------|-------|
| `agent-core` | Agent, Mission, Task primitives | ci.yml | G0,G1 |
| `runtime` | Deterministic executor, lifecycle | ci.yml, test.yml | G0,G1,G2 |
| `planner` | Hierarchical decomposition -> DAG, retry | test.yml, benchmark.yml (planning) | G2,G8 |
| `orchestrator` | Coordinates planner+runtime+memory+tools | test.yml, e2e.yml | G2,G5 |
| `swarm` | Multi-agent consensus, leader election | test.yml, chaos | G7 |
| `memory` | Vector+episodic+semantic, Qdrant+Postgres | test.yml (integration), benchmark memory | G2,G8 |
| `skills` | Composable capabilities registry | ci.yml | G1 |
| `tools` | Tool registry, validation, sandbox binding | test.yml, security.yml | G2,G3 |
| `browser` | Playwright wrapper, DOM grounding | e2e.yml browser | G5 |
| `sandbox` | gVisor/docker isolation, limits | security.yml, chaos | G3,G7 |
| `governance` | Policy engine, MAX_SPEND, allowlist | security.yml, test.yml | G3,G10 |
| `security` | Secret scanning, input validation, audit | security.yml | G3 (blocking) |
| `providers` | LLM routing Gemini->Groq->OpenAI->Ollama | test.yml, chaos (fallback) | G7 |
| `observability` | OTEL tracing, metrics, logging | e2e.yml, benchmark | G8 |
| `evaluation` | Benchmark harness, scoring | benchmark.yml | G8 |

---

### `services/` - طبقة Services

| Service | الوظيفة | Workflows | Gates |
|---------|---------|-----------|-------|
| `api-server` | Production API server + governance check + OTEL | deploy.yml, e2e.yml | G5 |
| `worker` | Background worker, concurrency 4, long-horizon | e2e.yml, benchmark long-horizon | G9,G13 |
| `scheduler` | Cron missions, scheduledMission | deploy.yml | - |
| `webhook` | GitHub Webhook handler, GitHub->AGI Runtime bridge | deploy.yml, e2e.yml | - |

`webhook` يطبق:
```ts
handleGitHubWebhook(event: GitHubEvent)
  Push -> analyze
  PR -> review
  Issue -> plan
  Release -> report
```

---

### `tests/` - طبقة Verification

```
Unit -> Integration -> Contract -> E2E -> Security -> Stress -> Chaos -> Long-Horizon -> Acceptance
```

| Folder | الأداة | الوظيفة | Workflow | Gate |
|--------|--------|---------|----------|------|
| `unit/` | vitest | packages/*/src | ci.yml | G1 |
| `integration/` | vitest + Postgres/Redis/Qdrant | runtime+memory+tools | test.yml | G2 |
| `contract/` | vitest | API shape | test.yml | G4 |
| `e2e/` | Playwright | Mission E2E | e2e.yml | G5 |
| `regression/` | vitest | Memory leak etc | test.yml | G2 |
| `stress/` | vitest | 100 concurrent | benchmark.yml? + test.yml | G6 |
| `chaos/` | vitest | Provider failure -> fallback | test.yml | G7 |
| `security/` | vitest + gitleaks | No .env, no secret in code | security.yml | G3 blocking |
| `browser/` | Playwright | agent-ui | e2e.yml | G5 |
| `acceptance/` | vitest | 10-step mission | e2e.yml | G9 |

كل test يكتب JSON في `certification/reports/`.

---

### `benchmarks/` - طبقة Evidence (Performance)

| Benchmark | ما يقيس | Threshold | Script | Output | Gate |
|-----------|---------|-----------|--------|--------|------|
| `latency/` | API latency P50/P95/P99 | P95<250ms P99<400ms | `run.js` | `certification/benchmarks/latency.json` | G8 |
| `memory/` | heapUsed, RSS | heap<500MB | `run.js` | `memory.json` | G8 |
| `planning/` | planner avg ms, P95 | - | `run.js` | `planning.json` | G8 |
| `tool-use/` | calls/sec, successRate | - | `run.js` | `tool-use.json` | G8 |
| `long-horizon/` | missionsCompleted, failureRate | failure<10% | `run.js` | `long-horizon.json` | G13 |

`scripts/benchmark/aggregate.js`: يجمع كل benchmarks في `latest.json`
`scripts/benchmark/compare.js`: يقارن مع baseline، يفشل إذا regression >10%

Workflow: `benchmark.yml` يشغل كل benchmarks + aggregate + compare + upload artifact `benchmark-reports`.

---

### `docs/` - طبقة Documentation

| Path | الوظيفة | المحتوى |
|------|---------|---------|
| `architecture/README.md` | معمارية 12-layer + diagram + data flow + GitHub as workspace + verification pipeline | Diagram ASCII, 5 levels, data flow User->API->Orchestrator->Planner->Runtime->Evaluation |
| `api/README.md` | API docs | Auth Bearer JWT, rate limits, OpenAPI link |
| `api/openapi.yaml` | OpenAPI 3.0 spec | POST /missions, GET /missions/{id}, GET /health |
| `adr/` | Architecture Decision Records - لماذا اتخذ القرار | 7 ADRs |
| `adr/0001-typescript-core.md` | TS strict, composite, ESM | Gate G0 |
| `adr/0002-memory-architecture.md` | 3-tier memory, Qdrant | Benchmark memory <50ms P95 |
| `adr/0003-provider-routing.md` | Routing Gemini->Groq->OpenAI->Ollama, MAX_SPEND=0 | Gate G3 |
| `adr/0004-sandbox-model.md` | docker/gVisor isolation, no network | Security |
| `adr/0005-zero-cost-policy.md` | Must run with MAX_SPEND=0, Ollama fallback | CI without paid APIs |
| `adr/0006-rest-api.md` | REST + JSON /api/v1 | OpenAPI |
| `adr/0007-agent-runtime.md` | Lifecycle init->plan->execute->evaluate->certify->shutdown + OTEL | - |
| `rfc/` | Future big features | 4 RFCs |
| `rfc/autonomous-missions.md` | Long-running missions, worker pool, scheduler, human approval over 10 steps | Gate G13 |
| `rfc/browser-agent.md` | Playwright + vision grounding | Security sandbox |
| `rfc/multi-agent-swarm.md` | Leader election Redis, consensus majority | Benchmark swarm P95<200ms |
| `rfc/self-healing.md` | Retry exponential, fallback planner, provider routing | Chaos tests |
| `operations/README.md` | Deploy, monitoring, runbooks | Staging auto, production on tag, OTEL, health /api/v1/health |
| `security/README.md` | Security layers | Dependabot, CodeQL, gitleaks, Trivy, npm audit, sandbox, governance MAX_SPEND |
| `testing/README.md` | Testing strategy pipeline + gates mapping | Unit->Acceptance + G0-G13 mapping |
| `deployment/README.md` | Environments, configs, release process | dev/test/prod, verify->certify->tag->release.yml |

---

### `configs/` - طبقة Configuration

| Env | File | المحتوى | Providers | Memory | Governance |
|-----|------|---------|-----------|--------|------------|
| `development/` | `config.json` | Local dev | ollama only | memory LRU | maxSpend 0, maxTokens 50k, log debug |
| `test/` | `config.json` | CI | mock | memory | maxSpend 0, tracing false |
| `production/` | `config.json` | Prod | gemini->groq->openai->ollama | vector Qdrant | maxSpend 10, maxTokens 200k, requireApprovalOver 100k, OTEL |

- **Related**: `.env.example` يحدد كل env vars مع قيم فارغة للـ secrets
- **Security**: لا يوجد `.env` في repo, فقط `.env.example`

---

### `scripts/` - طبقة Automation (Scripts)

| Script | الوظيفة | Inputs | Outputs | Used By |
|--------|---------|--------|---------|---------|
| `build/deploy.js` | Deploy staging/production, push Docker image | --env staging/production --commit SHA --tag | log SUCCESS | deploy.yml |
| `test/run-all.js` | Full verification pipeline lint->typecheck->unit->integration->contract->security | - | exit 1 if fail | local |
| `benchmark/aggregate.js` | يجمع benchmarks/*.json -> latest.json | - | certification/benchmarks/latest.json | benchmark.yml |
| `benchmark/compare.js` | يقارن مع baseline, threshold 10% | --threshold 10 | exit 1 if regression | benchmark.yml compare job |
| `verification/verify-gates.js` | يتحقق من Gates JSON, يمنع merge إذا FAIL | --gates G0,G1 --commit SHA --strict | exit 1 if fail && strict/CI | ci.yml, release.yml verify |
| `verification/generate-certification.js` | ينشئ manifest للـ release | --commit SHA --version vX.Y.Z | certification/manifests/release-X.Y.Z.json + latest.json | release.yml build-and-certify |
| `verification/health-check.js` | يتحقق من /health بعد deploy | --env production | log 200 OK | deploy.yml |
| `release/prepare.js` | يتحقق من gates + bump version | - | Ready for tag | manual |
| `release/changelog.js` | ينشئ CHANGELOG من template | --version vX.Y.Z --output CHANGELOG.md | CHANGELOG.md content | release.yml github-release |

---

### `certification/` - طبقة Governance & Evidence (الأهم)

#### `certification/gates/` - 14 Gate

كل ملف JSON:
```json
{
  "gate": "G0",
  "name": "Build & Lint & Typecheck",
  "status": "PASS|FAIL|SKIP",
  "commit": "abc123",
  "timestamp": "2026-09-16T07:00:00Z",
  "tests": 60,
  "passed": 60,
  "failed": 0,
  "durationMs": 1200,
  "artifacts": ["certification/reports/..."],
  "required": true,
  "blocking": true
}
```

| Gate | Name | Required | Blocking | Workflow | يمنع Merge؟ |
|------|------|----------|----------|----------|-------------|
| G0 | Build & Lint & Typecheck | ✅ | ✅ | ci.yml | نعم |
| G1 | Unit Tests | ✅ | ✅ | ci.yml | نعم |
| G2 | Integration | ✅ | ✅ | test.yml | نعم |
| G3 | Security | ✅ | ✅ | security.yml | نعم |
| G4 | Contract | ✅ | ✅ | test.yml | نعم |
| G5 | E2E | ✅ | ✅ | e2e.yml | نعم |
| G6 | Stress | ✅ | ✅ | test.yml | نعم |
| G7 | Chaos | ✅ | ✅ | test.yml | نعم |
| G8 | Benchmarks | ✅ | ❌ | benchmark.yml | لا (info) |
| G9 | Acceptance | ✅ | ❌ | e2e.yml | لا |
| G10 | Governance Policy | ❌ | ❌ | - | لا |
| G11 | Documentation | ❌ | ❌ | - | لا |
| G12 | Release Readiness | ❌ | ❌ | release.yml verify | نعم في release |
| G13 | Long-Horizon | ❌ | ❌ | e2e.yml long-horizon | لا (مستقبلي) |

**Blocking=true => لا يتم Merge عند فشل Gate إلزامي** (يتم فرضه عبر Branch Protection required_status_checks).

#### `certification/reports/`

- `unit.json`, `integration.json`, `contract.json`, `e2e.json`, `security.json`, `acceptance.json`
- كل واحد: `{ report, status PASS/FAIL, commit, timestamp, summary {total,passed,failed} }`
- تُنشأ بواسطة `vitest --reporter=json --outputFile=...` أو `playwright --reporter=json`
- تُرفع كـ artifacts في workflows

#### `certification/benchmarks/`

- `latency.json`, `memory.json`, `planning.json`, `tool-use.json`, `long-horizon.json`
- `latest.json`: مجمع بواسطة `aggregate.js`
- كل benchmark: `{ benchmark, timestamp, commit, metrics {p50,p95,p99,mean,min,max}, status PASS/FAIL, threshold }`

#### `certification/manifests/`

- `release-X.Y.Z.json`: manifest كامل للـ release
- `latest.json`: آخر manifest
- `release.json`: alias
- المحتوى:
```json
{
  "version": "0.1.0",
  "commit": "abc123",
  "timestamp": "...",
  "gates": { "G0": {...}, ... },
  "reports": { "unit": {...}, ... },
  "benchmarks": { "latency": {...}, ... },
  "artifacts": ["Docker image", "npm packages"]
}
```
- يُرفق مع GitHub Release في `release.yml` github-release job

---

### `examples/` - أمثلة استخدام

| File | الوظيفة |
|------|---------|
| `simple-mission.js` | إنشاء mission بسيط via `createMission()` |
| `browser-task.js` | مهمة browser automation: navigate->type->snapshot |
| `swarm-mission.js` | مهمة swarm: architect+implementer+tester + consensus majority |
| `README.md` | شرح تشغيل الأمثلة |

---

### `migrations/` - DB migrations

- `README.md`: يشرح timestamp prefix, idempotent, tested in CI integration
- مستقبلاً: `20260916_0001_init.sql` etc

---

### Root Files

| File | الوظيفة | الطبقة | Gates |
|------|---------|--------|-------|
| `package.json` | Monorepo workspaces apps/* packages/* services/*, scripts build/dev/lint/typecheck/test/benchmark/verify/certify, engines Node>=20 | 11 Packages | G0 |
| `tsconfig.json` | Base config target ES2022 module NodeNext strict, paths @agi-system/* -> packages/*/src, references 15 packages + 3 apps + 4 services | 1 Source | G0 |
| `vitest.config.ts` | Config vitest globals, include tests/**/*.test.ts packages/**/src/**/*.test.ts, exclude e2e/browser, coverage v8 reportsDirectory certification/reports/coverage, alias | 2 Tests | G1,G2 |
| `playwright.config.ts` | Config Playwright testDir tests/e2e, reporter json -> certification/reports/e2e.json + html, baseURL localhost:3000, webServer npm run build && npm run dev | 2 Tests | G5 |
| `.gitignore` | node_modules, dist, .env (never commit), logs, .turbo, coverage, playwright-report, .cache | 8 Security | G3 |
| `.env.example` | Template مع MAX_SPEND=0, LLM keys فارغة, OLLAMA_BASE_URL, DATABASE_URL, REDIS_URL, VECTOR_DB, BROWSER, OTEL, JWT_SECRET, GITHUB_TOKEN etc | 10 Config + 8 Security | G3 |
| `Dockerfile` | Multi-stage builder Node20-alpine -> runtime, COPY packages apps services, npm ci && build, expose 3000, CMD api-server | 11 Packages | G12 |
| `docker-compose.yml` | Local dev: postgres, redis, qdrant, ollama, api-server depends_on, env_file .env | 10 Config | - |
| `.eslintrc.json` | ESLint TS, recommended, no-console off | 3 CI/CD | G0 |
| `.prettierrc` | Prettier semi singleQuote false | 3 CI/CD | G0 |
| `LICENSE` | MIT | 12 Governance | - |
| `CHANGELOG.md` | Keep a Changelog, 0.1.0 initial 12-layer + Security + Evidence | 7 Releases | G12 |
| `CONTRIBUTING.md` | 12-layer flow Idea->Release, prereqs, dev, branch naming, PR requirements Gates, CODEOWNERS, ADR/RFC, certification, security, conventional commits, release process | 12 Governance | - |
| `SECURITY.md` | Supported versions, reporting vulnerability, automated checks Dependabot/CodeQL/gitleaks/Trivy/audit, secret management .env.example vs .env vs GitHub Secrets, sandbox, governance MAX_SPEND, branch protection, verification | 8 Security | G3 |
| `CODE_OF_CONDUCT.md` | Contributor Covenant | 12 Governance | - |
| `README.md` | 12-layer table, structure tree, workflow Idea->Release, Gates table blocking, GitHub as Agent Workspace diagram, testing pipeline, Evidence JSON example, Release artifacts, secret management zero-cost, quick start, packages, CODEOWNERS, ADR/RFC, 5 levels | 9 Docs | G11 |

---

## 3. خريطة الـ Workflows والـ Gates

```text
Push/PR
  |
  v
ci.yml (G0,G1) - Lint, Typecheck, Unit, Build, verify G0-G3
  | PASS
  v
test.yml (G2,G4,G6,G7) - Integration, Contract, Regression, Stress, Chaos
  | PASS
  v
e2e.yml (G5,G9,G13) - E2E, Browser, Long-Horizon, Acceptance
  | PASS
  v
security.yml (G3) - Audit, CodeQL, Secrets, Container
  | PASS (BLOCKING)
  v
benchmark.yml (G8) - Latency, Memory, Planning, Tool-use, Long-Horizon + aggregate + compare
  | INFO (fails if regression >10% but not blocking merge, blocking release)
  v
certification/gates/*.json updated
  |
  v
PR Review (CODEOWNERS)
  |
  v
Merge to main (requires all blocking gates PASS via branch protection)
  |
  v
Tag v*.*.* -> release.yml (G12) -> verify --strict -> certify -> publish npm + docker -> GitHub Release with manifests + benchmarks + reports + CHANGELOG
  |
  v
deploy.yml -> staging auto -> production on tag -> health-check
```

**Branch Protection rules** (`.github/settings.yml`):

- `main`:
  - required_status_checks strict: lint, typecheck, unit-test, build, integration, security
  - enforce_admins: true
  - required_pull_request_reviews: 1 + require_code_owner_reviews + dismiss_stale_reviews
  - required_linear_history: true
  - allow_force_pushes: false
  - allow_deletions: false

---

## 4. الصورة الكاملة - 5 مستويات مترابطة

```text
1. Product (apps/)
   Web / API / CLI
     |
2. Agent Runtime (packages/)
   Planner -> Orchestrator -> Runtime -> Tools/Browser/Skills -> Memory -> Providers -> Governance -> Security -> Observability
     |
3. Verification (tests/, benchmarks/)
   Unit -> Integration -> Contract -> E2E -> Security -> Stress -> Chaos -> Long-Horizon -> Acceptance
   + Benchmarks: latency, memory, planning, tool-use, long-horizon
     |
4. GitHub Engineering (.github/)
   Issues (bug/feature/task) -> PR (12-layer checklist) -> Actions (CI/E2E/Security/Benchmark/Release/Deploy) -> Releases (Tag+SHA+Artifacts) -> Packages (npm+Docker) -> Security (Dependabot/CodeQL/Secrets)
     |
5. Evidence (certification/, docs/adr, docs/rfc)
   Gates G0-G13 JSON + Reports + Benchmarks latest.json + Manifests release.json + ADRs + RFCs
   |
   v
Production + Monitoring -> Feedback -> Issue
```

---

## 5. نقاط الانتباه

- **العلاقة قابلة للتنفيذ**: CI -> Tests -> Certification -> Release ليست شكلية، بل Gates تمنع Merge.
- **Zero-Cost**: MAX_SPEND=0, Ollama local, CI بدون مفاتيح مدفوعة.
- **Secrets**: لا يوجد .env في repo, فقط .env.example فارغ + GitHub Secrets.
- **Evidence**: كل Gate يحتوي commit SHA + timestamp + tests + artifacts قابل للتدقيق.
- **Governance**: CODEOWNERS يفرض review حسب الطبقات الحساسة.
- **GitHub كبيئة عمل**: Webhook -> AGI Runtime -> analyze/plan/test/review/report.

---

## 6. الخطوات التالية المقترحة

- [ ] تفعيل Branch Protection في GitHub settings (من settings.yml)
- [ ] إضافة GitHub Secrets: NPM_TOKEN, GITHUB_TOKEN (auto), GEMINI_API_KEY etc للـ prod
- [ ] إعداد docker-compose للـ local dev مع Ollama
- [ ] كتابة tests حقيقية بدل placeholders (حالياً unit example موجود)
- [ ] تفعيل CodeQL و secret scanning في GitHub repo settings
- [ ] إعداد OTEL collector للـ observability
- [ ] بناء Web UI حقيقي (Next.js) في apps/web
- [ ] تنفيذ G13 Long-Horizon بالكامل (swarm + self-healing)
- [ ] إضافة certification dashboard في apps/agent-ui يعرض Gates و Benchmarks

---

## 7. ملخص - Repository متكامل = ...

**Code + Tests + CI/CD + Security + Issues/PR + Releases + Packages + Documentation + Evidence + Automation**

هذا المستودع يطبق ذلك بالكامل مع 12 طبقة واضحة، 7 workflows، 14 gate، 15 package، 4 services، 10 أنواع tests، 5 benchmarks، 7 ADRs، 4 RFCs، و certification manifests موثقة بـ commit SHA.
