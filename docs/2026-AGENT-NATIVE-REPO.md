# AGI-OS 2026 - Agent-Native Repository - الشكل النهائي

> هذا الملف يفصل ما يجب أن يكون **داخل Git** vs **GitHub Settings** vs **AGI Runtime** حسب نموذج 2026.

تاريخ: 2026-09-16
المرجع: Rulesets, Artifact Attestations, Workflow Execution Protections - GitHub Docs 2026

---

## 1. الفرق الجوهري: 2023 vs 2026

| قديم (2023) | حديث (2026) | لماذا مهم لـ AGI-OS |
|-------------|-------------|---------------------|
| Git repository | Software delivery system | المستودع = منصة تسليم برمجيات موثقة |
| Branch protection | **Rulesets** مرنة (branches, tags, push, signatures, status checks, deployment) | حماية أدق: تمنع merge إلا إذا attestations + evaluations + security PASS |
| Build artifact | **Artifact + provenance/attestation + SBOM** | إثبات أن ما تم بناؤه واختباره حدث فعلاً وليس مجرد README يقول PASS |
| CI فقط | CI + security + governance + deployment + supply chain | CI يفصل صلاحية المساهمة عن تشغيل Workflows (workflow execution protections) |
| Tests | Tests + **evaluations** + benchmarks + evidence | Tests تثبت أن الكود يعمل، Evaluations تثبت أن الوكيل ذكي وآمن |
| README | Documentation + ADR + RFC + operational docs + supply-chain | التوثيق يشمل قرارات وعمليات وسلسلة توريد |

---

## 2. الهيكل النهائي 2026 - ملف ملف

```text
agi-system/
│
├── apps/                 # منتجات وواجهات (Product Layer)
│   ├── web/
│   ├── api/
│   └── agent-ui/
│
├── packages/             # Core / Runtime / Memory / Skills / Tools (Agent Runtime)
│   ├── agent-core/
│   ├── runtime/
│   ├── planner/
│   ├── orchestrator/
│   ├── swarm/
│   ├── memory/
│   ├── skills/
│   ├── tools/
│   ├── browser/
│   ├── sandbox/
│   ├── governance/
│   ├── security/
│   ├── providers/
│   ├── observability/
│   └── evaluation/
│
├── services/             # API / Worker / Scheduler / Webhooks
│   ├── api-server/
│   ├── worker/
│   ├── scheduler/
│   └── webhook/          # GitHub -> AGI Runtime bridge
│
├── tests/                # Verification - هل النظام يعمل؟
│   ├── unit/
│   ├── integration/
│   ├── contract/         # يتحقق من schemas/
│   ├── e2e/
│   ├── security/
│   ├── stress/
│   ├── chaos/
│   ├── regression/
│   ├── browser/
│   └── acceptance/
│
├── evaluations/          # NEW 2026 - هل الوكيل قادر وآمن؟
│   ├── capabilities/     # planning, tool-use, memory, reasoning
│   ├── safety/           # governance, secret leak, dangerous tools - G14 CRITICAL
│   ├── long-horizon/     # 10-50 خطوة بدون انحراف
│   ├── tool-use/         # دقة استدعاء الأدوات
│   ├── browser/          # مهمات ويب حقيقية
│   ├── swarm/            # تعاون متعدد الوكلاء
│   └── regression/       # لا انحدار في القدرات
│
├── benchmarks/           # Performance - P50/P95/P99
│   ├── latency/
│   ├── memory/
│   ├── planning/
│   ├── tool-use/
│   └── long-horizon/
│
├── certification/        # Evidence - إثبات قابل للتدقيق
│   ├── gates/
│   │   ├── G0.json .. G14.json  # G14 Safety NEW 2026
│   ├── reports/
│   │   ├── unit.json, integration.json, e2e.json, security.json
│   │   └── evaluations/  # NEW: capabilities.json, safety.json, latest.json
│   ├── benchmarks/
│   │   └── latest.json
│   ├── attestations/     # NEW 2026 - SLSA provenance + SBOM attestation
│   │   └── <commit>.json
│   ├── sbom/             # NEW 2026 - SPDX + CycloneDX
│   │   ├── sbom.spdx.json
│   │   └── sbom.cyclonedx.json
│   └── manifests/
│       └── release.json  # يجمع كل شيء: gates+reports+benchmarks+sbom+attestations
│
├── schemas/              # NEW 2026 - عقود النظام
│   ├── api/              # OpenAPI + mission.json
│   ├── events/           # github-webhook.json
│   ├── tools/            # tool-definition.json
│   ├── missions/         # task-dag.json
│   ├── governance/       # policy.json
│   └── memory/           # memory-record.json
│
├── migrations/           # DB evolution
│
├── docs/
│   ├── architecture/     # 12-layer diagram + 5 levels + data flow
│   ├── api/
│   ├── adr/              # 7 ADRs - لماذا
│   ├── rfc/              # 4 RFCs - ميزات كبيرة
│   ├── security/
│   ├── operations/
│   ├── testing/
│   ├── deployment/
│   ├── supply-chain/     # NEW 2026
│   ├── rulesets/         # NEW 2026 - يوثق Rulesets
│   ├── environments/     # NEW 2026 - يوثق Environments
│   └── evaluations/      # NEW 2026 - يوثق Evaluations
│
├── configs/
│   ├── development/
│   ├── test/
│   └── production/
│
├── scripts/
│   ├── build/
│   ├── test/
│   ├── benchmark/
│   ├── release/
│   ├── verification/
│   ├── evaluation/       # NEW - verify-safety.js, aggregate.js
│   ├── attestation/      # NEW - generate.js, verify.js
│   └── supply-chain/     # NEW - policy-check.js, license-check.js, provenance
│
├── examples/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── test.yml
│   │   ├── e2e.yml
│   │   ├── security.yml
│   │   ├── benchmark.yml
│   │   ├── evaluation.yml    # NEW 2026 - capabilities/safety/long-horizon
│   │   ├── attestation.yml   # NEW 2026 - SBOM + provenance + attest
│   │   ├── supply-chain.yml  # NEW 2026 - SBOM, license, dependency-review
│   │   ├── governance.yml    # NEW 2026 - spend policy, workflow protections
│   │   ├── release.yml       # UPDATED 2026 - includes SBOM + attestations + provenance
│   │   └── deploy.yml
│   ├── rulesets/             # NEW 2026 - JSON يمثل Rulesets (يُطبق عبر API أو UI)
│   │   ├── main-branch.json  # Branch protection + required status checks + signatures + patterns
│   │   ├── tags.json         # Tag protection SemVer + signatures
│   │   └── security.json     # Code scanning + required checks
│   ├── environments/         # NEW 2026 - يوثق staging/production protection + secrets
│   │   ├── staging.yml
│   │   └── production.yml
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS
│   ├── dependabot.yml
│   └── settings.yml          # Probot settings - branch protection legacy
│
├── .env.example              # Zero-cost template
├── SECURITY.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE
├── README.md
├── package.json
└── tsconfig.json
```

---

## 3. فصل: داخل Git vs GitHub Settings vs AGI Runtime

### A. داخل Git (يُcommit)

**يجب أن يكون في Git لأنه كود أو إثبات:**

- `apps/`, `packages/`, `services/`, `tests/`, `evaluations/`, `benchmarks/`, `schemas/`, `configs/`, `scripts/`, `examples/`, `migrations/`
- `.github/workflows/` - كل workflows (CI, evaluation, attestation, supply-chain, governance, release, deploy)
- `.github/rulesets/` - JSON يمثل Rulesets (مرجع، يُطبق يدوياً أو عبر API)
- `.github/environments/` - توثيق للـ environments (القيم الحقيقية في GitHub UI)
- `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`, `dependabot.yml`
- `docs/` - architecture, adr, rfc, supply-chain, rulesets, environments, evaluations
- `certification/` - gates, reports, benchmarks, sbom, attestations, manifests (evidence)
- `.env.example` - فارغ، لا أسرار
- Root files: `package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `README.md`, etc.

**القاعدة:** أي شيء يمكن التحقق منه أو إعادة بنائه يجب أن يكون في Git.

### B. GitHub Settings (لا يظهر في شجرة الملفات، يُضبط في UI/API)

**هذا هو الجزء الذي لا يظهر في `ls` لكنه الأهم في 2026:**

```text
GitHub Repository Settings
│
├── Rulesets (2026 replacement for branch protection)
│   ├── main-branch-protection-2026 (main-branch.json)
│   │   ├── Require PR + CODEOWNERS review + 1 approval + resolve threads
│   │   ├── Required status checks: lint, typecheck, unit, build, integration, contract, e2e, security/*, evaluation/*, supply-chain/*
│   │   ├── Require linear history + signed commits
│   │   ├── Commit message pattern: conventional commits
│   │   ├── Branch name pattern: feat/*, fix/*, etc.
│   │   └── Block force pushes, deletions
│   ├── tag-protection-release (tags.json)
│   │   ├── Only SemVer v*.*.*
│   │   └── Require signed tags
│   └── security-and-compliance (security.json)
│       ├── Code scanning: CodeQL high threshold
│       ├── Required checks: dependency-audit, secret-scanning, sbom, provenance
│       └── Copilot code review on push
│
├── Environments
│   ├── staging (environments/staging.yml doc)
│   │   ├── No required reviewers (auto)
│   │   ├── Allowed branches: main, develop, arena/*
│   │   ├── Variables: API_URL, LOG_LEVEL, etc.
│   │   └── Secrets: DATABASE_URL, REDIS_URL, etc. (set in UI)
│   └── production (environments/production.yml doc)
│       ├── Required reviewers: governance-team + security-team
│       ├── Wait timer: 5 min
│       ├── Deployment branch policy: only protected branches (tags v*.*.*)
│       ├── Attestations required: provenance + sbom
│       ├── Checks: G0-G7 + G14 must PASS, benchmarks no regression >10%
│       └── Secrets: all prod secrets + NPM_TOKEN, GEMINI_API_KEY, etc.
│
├── Security
│   ├── Code scanning: CodeQL enabled
│   ├── Secret scanning: enabled + push protection
│   ├── Dependency review: enabled (supply-chain.yml)
│   ├── Dependabot: enabled (dependabot.yml)
│   └── Private vulnerability reporting: enabled
│
├── Actions Policies
│   ├── Workflow execution protections (2026)
│   │   ├── Separate code contribution from CI execution
│   │   ├── Fork PRs require approval to run workflows
│   │   ├── Workflows run with minimal permissions (contents:read)
│   │   └── No secrets passed to PR workflows from forks
│   ├── Artifact attestations: enabled
│   ├── OIDC: enabled for provenance
│   └── Environments: require approval for production
│
├── Packages
│   ├── GHCR: ghcr.io/sayedelazameydesign-crypto/12pro
│   └── npm: @agi-system/* with provenance
│
├── Attestations
│   ├── Build provenance: SLSA via actions/attest-build-provenance@v2
│   ├── SBOM: SPDX + CycloneDX via anchore/sbom-action
│   └── Verification: gh attestation verify
│
└── Repository Policies
    ├── No .env in repo (enforced by security.yml + policy-check.js)
    ├── MAX_SPEND=0 in .env.example (governance.yml)
    ├── Conventional commits (rulesets)
    └── Signed commits/tags (rulesets)
```

**كيف تُطبق Rulesets:**

- **يدوياً:** GitHub UI > Settings > Rules > Rulesets > New Ruleset > Import from `main-branch.json`
- **آلياً:** عبر GitHub API أو `gh` CLI أو Terraform
- **التوثيق:** `docs/rulesets/README.md` يشرح كل Ruleset

**القاعدة:** أي شيء يتعلق بالصلاحيات، الحماية، الأسرار، والـenvironments يجب أن يكون في GitHub Settings وليس في Git (لأمان).

### C. AGI Runtime نفسه (ينفذه الوكيل)

**هذا ما يجب أن ينفذه AGI Runtime، وليس مجرد ملفات:**

```text
AGI Runtime Execution
│
├── Source -> Runtime
│   ├── Load configs/development.json + .env
│   ├── Init packages: agent-core, runtime, planner, orchestrator, memory, etc.
│   ├── Governance check: MAX_SPEND, allowlist
│   └── Observability: OTEL tracing
│
├── Tests -> Evaluations
│   ├── Run tests/ (unit/integration/...) -> writes certification/reports/
│   ├── Run evaluations/ (capabilities/safety/long-horizon) -> writes certification/reports/evaluations/
│   │   ├── planning.eval.ts: can planner decompose?
│   │   ├── safety.eval.ts: does governance reject dangerous?
│   │   └── long-horizon: 10-step mission without drift?
│   └── Aggregate -> certification/reports/evaluations/latest.json + G14.json
│
├── Security
│   ├── Secret scanning: no secrets in logs
│   ├── Sandbox: tool execution isolated
│   └── Policy enforcement: block dangerous tools
│
├── Certification Gates
│   ├── verify-gates.js: checks G0-G14 JSON, blocks merge if FAIL
│   ├── Each gate: {gate, status, commit, timestamp, tests, passed, failed, artifacts}
│   └── Writes certification/manifests/latest.json
│
├── Artifact
│   ├── Build: npm run build + Docker build
│   ├── Package: tar.gz + checksums
│   └── SBOM: anchore/sbom-action -> spdx + cyclonedx
│
├── Attestation (2026)
│   ├── attest-build-provenance: links artifact to repo+commit+workflow
│   ├── attest-sbom: links SBOM to artifact
│   └── generate.js: writes certification/attestations/<commit>.json
│
├── Release
│   ├── Tag v*.*.* -> release.yml
│   ├── Verify: all blocking gates PASS + safety G14 100% + benchmarks no regression
│   ├── Publish: npm @agi-system/* with provenance + Docker ghcr.io with provenance+sbom
│   └── GitHub Release: attach manifests + benchmarks + reports + sbom + attestations + tar.gz + checksums
│
├── Deployment
│   ├── Staging auto on main (no approval)
│   ├── Production requires governance-team + security-team approval + 5min wait
│   ├── Checks: gates G0-G7+G14 PASS, attestation required, sbom required
│   └── Health check: /api/v1/health returns gates status
│
├── Observability
│   ├── OTEL traces: each phase init->plan->execute->evaluate->certify->shutdown
│   ├── Metrics: latency P95/P99, tool calls/sec, missions completed
│   └── Logs: JSON structured, no secrets
│
└── Feedback
    ├── GitHub Webhook -> services/webhook -> AGI Runtime
    │   ├── Push -> analyze
    │   ├── PR -> review
    │   ├── Issue -> plan
    │   └── Release -> report
    └── Monitoring -> Issue / Improvement -> loop back to Idea
```

**القاعدة:** Runtime هو الذي يحول الملفات الثابتة إلى نظام حي يثبت أن الاختبارات والتقييمات حدثت فعلاً.

---

## 4. Pipeline النهائي 2026 - من Source إلى Feedback

```text
Source (apps/packages/services/schemas/configs)
   ↓
Runtime (init + governance check + observability)
   ↓
Tests (unit/integration/contract/e2e/security/stress/chaos)
   ↓
Evaluations (capabilities/safety/long-horizon/tool-use/browser/swarm/regression) - NEW 2026
   ↓
Security (audit/CodeQL/secrets/container + policy-check)
   ↓
Certification Gates (G0-G14 JSON + reports + evidence) - G14 Safety NEW
   ↓
Benchmarks (latency/P95/P99/memory + aggregate + compare)
   ↓
Artifact (build + tar.gz + checksums)
   ↓
SBOM (SPDX + CycloneDX via anchore) - NEW 2026
   ↓
Attestation (SLSA provenance + SBOM attestation via actions/attest-*) - NEW 2026
   ↓
Release (Tag v*.*.* + verify strict + certify + publish npm with provenance + docker with provenance+sbom + GitHub Release with all manifests)
   ↓
Deployment (staging auto, production requires approval + attestation + sbom + gates)
   ↓
Observability (OTEL tracing + metrics + logs)
   ↓
Feedback (GitHub Webhook -> AGI Runtime -> analyze/plan/test/review/report -> Issue)
   ↓
Idea -> loop
```

**الفرق الجوهري في 2026:**

- **قديم:** Build artifact (tar.gz)
- **جديد:** Artifact + provenance/attestation + SBOM - يثبت أن ما تم بناؤه مرتبط بـ repo + commit + workflow + environment، ويمكن ربطه بـ SBOM، ويمكن التحقق منه عبر `gh attestation verify`.

- **قديم:** Branch protection
- **جديد:** Rulesets - أكثر مرونة: اشتراط PR + status checks + signatures + code scanning + deployment success + حتى تغطية قبل الدمج.

- **قديم:** CI فقط
- **جديد:** CI + security + governance + deployment + supply chain + workflow execution protections (فصل صلاحية المساهمة عن تشغيل CI).

---

## 5. Checklist 2026 - هل المستودع متكامل فعلاً؟

**نقاط الانتباه من طلبك:** وجود الملفات لا يعني أن النظام متكامل. يجب أن تكون Gates والـWorkflows والاختبارات مرتبطة فعلياً وتمنع الإصدار عند الفشل.

- [ ] **Rulesets مطبقة في GitHub Settings؟** - `main-branch.json` يتطلب 12 status check + signatures + linear history
- [ ] **Environments محمية؟** - production يتطلب approval من governance-team + security-team + wait timer + attestation required
- [ ] **Workflow execution protections مفعلة؟** - Fork PRs require approval, minimal permissions, no secrets to PR workflows
- [ ] **Attestations تُنشأ في كل release؟** - `release.yml` يستخدم `attest-build-provenance` + `attest-sbom` + Docker provenance+sbom
- [ ] **SBOM يُنشأ في كل build؟** - `attestation.yml` + `supply-chain.yml` + `release.yml` ينشئ SPDX + CycloneDX
- [ ] **Evaluations تمنع Merge؟** - `evaluation.yml` يشغل safety G14 BLOCKING, capabilities regression >5% ينبه
- [ ] **Gates تمنع الإصدار؟** - `release.yml verify` يشغل `verify --strict` + `verify-safety --strict` + `compare --threshold 10`
- [ ] **Schemas تُتحقق في Contract tests؟** - `tests/contract/` يتحقق من `schemas/api/mission.json` etc.
- [ ] **No secrets في repo؟** - `security.yml` + `governance.yml` + `policy-check.js` يفحص .env + gitleaks
- [ ] **Evidence قابل للتدقيق؟** - كل Gate JSON يحتوي commit SHA + timestamp + tests + artifacts + provenance

---

## 6. الخطوة التالية - ما يجب ضبطه الآن

### داخل Git (تم في هذا الـcommit)

- [x] `evaluations/` - 7 أنواع + أمثلة
- [x] `schemas/` - 6 أنواع JSON Schema
- [x] `.github/rulesets/` - 3 Rulesets JSON
- [x] `.github/environments/` - staging + production توثيق
- [x] `.github/workflows/evaluation.yml, attestation.yml, supply-chain.yml, governance.yml` - 4 workflows جديدة 2026
- [x] `release.yml` محدث - SBOM + attestation + provenance
- [x] `certification/attestations/`, `certification/sbom/` - evidence للـ supply chain
- [x] `certification/gates/G14.json` - Safety Gate جديد BLOCKING
- [x] `scripts/evaluation/`, `scripts/attestation/`, `scripts/supply-chain/` - automation

### GitHub Settings (يجب ضبطه يدوياً في UI)

1. **Rulesets:**
   - Settings > Rules > Rulesets > New > Import `main-branch.json` (enforcement active)
   - Import `tags.json` + `security.json`

2. **Environments:**
   - Settings > Environments > New environment: `staging` (no protection, allow main/develop/arena/*)
   - New environment: `production` (required reviewers: governance-team, security-team, wait 5min, deployment branches: protected only)

3. **Security:**
   - Settings > Code security > Enable: Dependency graph, Dependabot alerts + security updates, Code scanning (CodeQL), Secret scanning + push protection, Private vulnerability reporting

4. **Actions Policies:**
   - Settings > Actions > General > Workflow permissions: Read repository contents and packages permissions
   - Enable: Allow GitHub Actions to create and approve PRs (for release)
   - Settings > Actions > General > Fork PR workflows: Require approval for first-time contributors + Require approval for all outside collaborators

5. **Packages:**
   - Enable GHCR, set visibility

6. **Secrets & Variables:**
   - Settings > Secrets and variables > Actions > Secrets: `NPM_TOKEN`, `GEMINI_API_KEY`, etc.
   - Environments > production > Secrets: prod secrets
   - Environments > staging > Secrets: staging secrets

### AGI Runtime (يجب تنفيذه)

- [ ] تنفيذ `evaluations/` حقيقية بدل placeholders (حالياً simulated)
- [ ] ربط `schemas/` بـ `@agi-system/tools` validation
- [ ] تفعيل OTEL collector للـ observability
- [ ] بناء `apps/web` حقيقي (Next.js) يعرض Gates + Benchmarks + Attestations + Evaluations
- [ ] تنفيذ `services/webhook` GitHub -> AGI Runtime (analyze/plan/test/review/report)
- [ ] تنفيذ `scripts/evaluation/aggregate.js` + `verify-safety.js` في CI فعلياً
- [ ] التحقق من attestations عبر `gh attestation verify` في `deploy.yml`

---

## 7. ملخص - Repository متكامل 2026 = ...

**قديم:** Code + Tests + CI/CD + Security + Issues/PR + Releases + Packages + Documentation + Evidence + Automation

**2026:** كل ما سبق + **Rulesets + Environments + Artifact Attestations + SBOM + Evaluations + Schemas + Supply Chain + Workflow Execution Protections + Provenance**

**الصيغة النهائية:**

```text
Repository متكامل 2026 = 
  Source (apps/packages/services/schemas) +
  Runtime (governance/observability) +
  Verification (tests + evaluations + benchmarks) +
  Security (audit/CodeQL/secrets/container + policy) +
  Evidence (gates G0-G14 + reports + benchmarks + attestations + sbom + manifests) +
  Supply Chain (SBOM + provenance + attestations + license + dependency-review) +
  GitHub Engineering (PR/Issues/Actions/Releases/Packages + Rulesets + Environments + Attestations + Workflow Protections) +
  Automation (scripts/build/test/benchmark/release/verification/evaluation/attestation/supply-chain) +
  Documentation (architecture + adr + rfc + operations + security + supply-chain + rulesets + environments + evaluations) +
  Deployment (staging auto + production with approval + attestation required) +
  Observability (OTEL + metrics + logs) +
  Feedback (webhook -> AGI Runtime -> Issue)
```

**والأهم:** العلاقة بينها **قابلة للتنفيذ والتحقق** - Gates + Rulesets + Attestations تمنع Merge/Release/Deploy عند الفشل، وليست مجرد ملفات شكلية.

---

## 8. المراجع

- [About rulesets - GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Artifact attestations - GitHub Docs](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [Workflow execution protections - GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/actions-policies/workflow-execution-protections)
- [Supply chain security](https://docs.github.com/en/code-security/supply-chain-security)
