# AGI-OS / Agent OS - 12-Layer + 2026 Agent-Native Repository

> **2026 تطور:** GitHub لم يعد مجرد `src + tests + workflows`، بل أصبح **منصة هندسة وبرنامج Supply Chain وAutomation** مع **Rulesets, Artifact Attestations, SBOM, Environments, Workflow Execution Protections**.

هذا المستودع يطبّق **12 طبقة احترافية + نموذج 2026 Agent-Native** لتحويل GitHub من Git server إلى **سجل إثبات وبيئة عمل للوكيل مع سلسلة توريد موثقة**.

---

## 🆕 ما الجديد في 2026؟

| قديم (2023) | حديث (2026) | المرجع |
|-------------|-------------|--------|
| Branch protection | **Rulesets** مرنة (branches, tags, signatures, status checks, deployment) | [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) |
| Build artifact | **Artifact + provenance/attestation + SBOM** - يربط الـartifact بالـrepo والـcommit والـworkflow | [Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) |
| CI فقط | CI + security + governance + deployment + **workflow execution protections** (فصل صلاحية المساهمة عن تشغيل CI) | [Workflow protections](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/actions-policies/workflow-execution-protections) |
| Tests | Tests + **Evaluations** + benchmarks + evidence | Evaluations تثبت أن الوكيل ذكي وآمن |

---

## 📊 12 طبقة + 2026

| # | الطبقة | المسارات | الوظيفة | 2026 الجديد |
|---|--------|----------|---------|-------------|
| 1 | Source Code | `apps/`, `packages/`, `services/`, `schemas/` | كود + عقود | `schemas/` للـ contracts |
| 2 | Tests | `tests/` | إثبات أن النظام يعمل | - |
| 3 | Evaluations **NEW** | `evaluations/` | إثبات أن الوكيل قادر وآمن | capabilities/safety/long-horizon |
| 4 | CI/CD | `.github/workflows/` | Build/Test/Lint/Deploy | evaluation, attestation, supply-chain, governance workflows |
| 5 | Automation | `.github/` | أتمتة | Rulesets, Environments, Attestations |
| 6 | Issues | `.github/ISSUE_TEMPLATE/` | إدارة العمل | - |
| 7 | PRs | `PULL_REQUEST_TEMPLATE.md` | مراجعة | Gates G0-G14 + safety |
| 8 | Releases | Tags/Changelog/Artifacts | إصدارات موثقة | + provenance + SBOM + attestations |
| 9 | Security | Dependabot/CodeQL/Secrets | حماية | + SBOM + license + dependency-review |
| 10 | Documentation | `docs/` | توثيق | + supply-chain, rulesets, environments, evaluations |
| 11 | Configuration | `.env.example`, `configs/` | إعدادات | + environments staging/production |
| 12 | Governance & Evidence | `certification/` | إثبات | + attestations, sbom, G14 safety |

---

## 🏗️ الهيكل النهائي 2026

```text
agi-system/
│
├── apps/                 # Product
├── packages/             # Agent Runtime (15 packages)
├── services/             # API/Worker/Scheduler/Webhook (GitHub->AGI bridge)
│
├── tests/                # Verification: هل النظام يعمل؟
│   ├── unit/integration/contract/e2e/security/stress/chaos/...
│
├── evaluations/          # NEW 2026: هل الوكيل قادر وآمن؟
│   ├── capabilities/     # planning, tool-use
│   ├── safety/           # governance, secret leak, dangerous tools - G14 CRITICAL
│   ├── long-horizon/     # 10-50 خطوة
│   ├── tool-use/
│   ├── browser/
│   ├── swarm/
│   └── regression/
│
├── benchmarks/           # P50/P95/P99/memory
├── certification/        # Evidence
│   ├── gates/ G0-G14     # G14 Safety NEW
│   ├── reports/ + evaluations/
│   ├── benchmarks/
│   ├── attestations/     # NEW: SLSA provenance
│   ├── sbom/             # NEW: SPDX + CycloneDX
│   └── manifests/
│
├── schemas/              # NEW: API/events/tools/missions/governance/memory contracts
│
├── docs/
│   ├── architecture/ api/ adr/ rfc/ security/ operations/ testing/ deployment/
│   ├── supply-chain/     # NEW: SBOM, provenance, attestations
│   ├── rulesets/         # NEW: يوثق Rulesets
│   ├── environments/     # NEW: staging/production protection
│   └── evaluations/      # NEW: يوثق evaluations
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml, test.yml, e2e.yml, security.yml, benchmark.yml
│   │   ├── evaluation.yml    # NEW: capabilities/safety/long-horizon
│   │   ├── attestation.yml   # NEW: SBOM + provenance + attest
│   │   ├── supply-chain.yml  # NEW: SBOM, license, dependency-review
│   │   ├── governance.yml    # NEW: spend policy, workflow protections
│   │   ├── release.yml       # UPDATED: includes SBOM + attestations + provenance
│   │   └── deploy.yml
│   ├── rulesets/             # NEW: main-branch.json, tags.json, security.json
│   ├── environments/         # NEW: staging.yml, production.yml
│   ├── ISSUE_TEMPLATE/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS
│   └── dependabot.yml
│
├── configs/ + .env.example (zero-cost)
├── scripts/
│   ├── evaluation/       # verify-safety.js, aggregate.js
│   ├── attestation/      # generate.js, verify.js
│   └── supply-chain/     # policy-check.js, license-check.js
│
└── package.json (workspaces + eval + attest + sbom scripts)
```

---

## 🔄 Pipeline 2026 - من Source إلى Feedback

```text
Source (apps/packages/services/schemas)
   ↓
Runtime (governance + observability)
   ↓
Tests (unit/integration/contract/e2e/security/stress/chaos)
   ↓
Evaluations (capabilities/safety/long-horizon/tool-use/browser/swarm) - NEW
   ↓
Security (audit/CodeQL/secrets/container + policy)
   ↓
Certification Gates (G0-G14 + reports + evidence) - G14 Safety NEW
   ↓
Benchmarks (latency/P95/P99/memory + aggregate + compare)
   ↓
Artifact (build + tar.gz + checksums)
   ↓
SBOM (SPDX + CycloneDX) - NEW
   ↓
Attestation (SLSA provenance + SBOM attestation) - NEW
   ↓
Release (Tag + verify strict + safety 100% + benchmarks no regression + SBOM + attestations + npm provenance + docker provenance+sbom)
   ↓
Deployment (staging auto, production requires approval + attestation + sbom + gates)
   ↓
Observability (OTEL)
   ↓
Feedback (GitHub Webhook -> AGI Runtime -> Issue) -> loop
```

**الفرق الجوهري:**

- **قديم:** Build artifact (tar.gz)
- **جديد 2026:** Artifact + provenance/attestation + SBOM - يثبت أن ما تم بناؤه مرتبط بـ repo + commit + workflow + environment، ويمكن التحقق عبر `gh attestation verify`.

---

## 🛡️ Rulesets + Environments + Workflow Protections (لا تظهر في `ls` لكنها الأهم)

### GitHub Settings (يُضبط في UI/API)

```text
GitHub Repository
│
├── Rulesets (2026)
│   ├── main-branch-protection-2026
│   │   ├── Require PR + CODEOWNERS + 1 approval + resolve threads
│   │   ├── Required checks: lint, typecheck, unit, build, integration, contract, e2e, security/*, evaluation/*, supply-chain/*
│   │   ├── Require linear history + signed commits
│   │   ├── Commit pattern: conventional commits
│   │   └── Block force pushes
│   ├── tag-protection-release (SemVer + signed tags)
│   └── security-and-compliance (CodeQL + sbom + provenance)
│
├── Environments
│   ├── staging: auto, no approval, branches main/develop/arena/*
│   └── production: requires governance-team + security-team approval + 5min wait + attestations required (provenance+sbom) + gates G0-G7+G14
│
├── Security
│   ├── Code scanning (CodeQL), Secret scanning + push protection, Dependency review, Dependabot
│
├── Actions Policies - Workflow Execution Protections (2026)
│   ├── Fork PRs require approval to run workflows
│   ├── Minimal permissions (contents:read)
│   └── No secrets to PR workflows from forks
│
├── Attestations
│   ├── Build provenance via actions/attest-build-provenance@v2 (SLSA)
│   ├── SBOM via anchore/sbom-action
│   └── Verify via gh attestation verify
│
└── Packages: GHCR + npm with provenance
```

**التوثيق:** `.github/rulesets/` (JSON) + `.github/environments/` (yml) + `docs/rulesets/`, `docs/environments/`, `docs/supply-chain/`

---

## 🧪 Tests vs Evaluations vs Benchmarks (2026)

| نوع | السؤال | مثال | الأداة | Gate |
|-----|--------|------|--------|------|
| Tests | هل النظام يعمل؟ | unit: agent-core init | vitest, Playwright | G1-G7 |
| Evaluations **NEW** | هل الوكيل قادر وآمن؟ | safety: reject when MAX_SPEND exceeded, no secret leak | vitest evaluations/ | G14 Safety BLOCKING |
| Benchmarks | هل الأداء ضمن الحدود؟ | latency P95<250ms | benchmarks/*/run.js | G8 |
| Certification | هل كل ما سبق PASS مع إثبات؟ | gates JSON + reports + attestations + sbom | verify-gates.js | G0-G14 |

**Safety Gate G14 جديد 2026 - 100% PASS مطلوب، يمنع Merge/Release.**

---

## 📜 Evidence / Attestations - إثبات أن ما تم بناؤه حدث فعلاً

بدلاً من `"All tests passed"`:

```json
{
  "gate": "G14",
  "name": "Safety Evaluation - 100% PASS required",
  "status": "PASS",
  "commit": "abc123",
  "tests": 8,
  "passed": 8,
  "score": 1.0,
  "blocking": true
}
```

**2026 الجديد:**

```json
{
  "version": "v1.5.0",
  "commit": "abc123",
  "attestations": {
    "buildProvenance": {
      "type": "https://slsa.dev/provenance/v1",
      "builder": "GitHub Actions",
      "workflow": "release.yml",
      "repository": "12pro",
      "verified": true
    },
    "sbom": {
      "type": "spdx",
      "path": "certification/sbom/sbom.spdx.json"
    }
  },
  "supplyChain": {
    "sbom": true,
    "provenance": true,
    "attestations": true
  }
}
```

**التحقق:**

```bash
gh attestation verify oci://ghcr.io/sayedelazameydesign-crypto/12pro:v1.5.0 --owner sayedelazameydesign-crypto
cat certification/sbom/sbom.spdx.json
cat certification/attestations/<commit>.json
```

كل Release:

```text
v1.5.0
├── Source (tag + SHA)
├── Docker image ghcr.io/...:v1.5.0 (with provenance+sbom)
├── npm @agi-system/* (with provenance)
├── tar.gz + checksums (with attestation)
├── benchmark-report.json + evaluations-report.json
├── sbom.spdx.json + sbom.cyclonedx.json
├── attestation.json (SLSA provenance)
└── certification manifest (gates+reports+benchmarks+sbom+attestations)
```

---

## 🚀 البدء السريع 2026

```bash
npm ci
npm run build
npm run lint && npm run typecheck
npm run test:unit
npm run eval:safety          # G14 - must PASS 100%
npm run eval:capabilities
npm run benchmark:all
npm run verify               # G0-G14
npm run verify:policy        # .env, CODEOWNERS, Rulesets, schemas
npm run verify:attestation   # SBOM + attestations exist?
npm run certify
npm run attest               # generate attestation manifest
npm run check:2026           # full 2026 check: policy+safety+attestation+benchmarks
```

---

## 📚 التوثيق الجديد 2026

- `docs/2026-AGENT-NATIVE-REPO.md` - الشكل النهائي ملف ملف + فصل Git vs GitHub Settings vs AGI Runtime
- `docs/BLUEPRINT.md` - Blueprint 12-layer الأصلي
- `docs/supply-chain/` - SBOM, provenance, attestations
- `docs/rulesets/` - يوثق Rulesets
- `docs/environments/` - يوثق staging/production
- `docs/evaluations/` - يوثق evaluations
- `docs/architecture/` - 12-layer + 5 مستويات + GitHub as Agent Workspace
- `schemas/` - عقود النظام (mission, task-dag, tool-definition, github-webhook, policy, memory)

---

## 🔐 Zero-Cost + Supply Chain

- `.env.example` فارغ، MAX_SPEND=0، Ollama local
- CI بدون مفاتيح مدفوعة
- Secrets في GitHub Secrets + Environments
- SBOM + provenance + attestations في كل release
- License check: MIT, Apache-2.0, ISC, BSD فقط

---

## 🎯 Repository متكامل 2026 = ...

**قديم:** Code + Tests + CI/CD + Security + Issues/PR + Releases + Packages + Documentation + Evidence + Automation

**2026:** كل ما سبق + **Rulesets + Environments + Artifact Attestations + SBOM + Evaluations + Schemas + Supply Chain + Workflow Execution Protections + Provenance**

```text
Repository 2026 = 
  Source (apps/packages/services/schemas) +
  Runtime (governance/observability) +
  Verification (tests + evaluations + benchmarks) +
  Security (audit/CodeQL/secrets/container + policy + license) +
  Evidence (gates G0-G14 + reports + benchmarks + attestations + sbom + manifests) +
  Supply Chain (SBOM + provenance + attestations) +
  GitHub Engineering (PR/Issues/Actions/Releases/Packages + Rulesets + Environments + Attestations + Workflow Protections) +
  Automation (scripts/*) +
  Documentation (architecture + adr + rfc + supply-chain + rulesets + environments + evaluations) +
  Deployment (staging auto + production with approval + attestation required) +
  Observability + Feedback
```

**والأهم:** العلاقة **قابلة للتنفيذ والتحقق** - Gates + Rulesets + Attestations تمنع Merge/Release/Deploy عند الفشل، وليست مجرد ملفات شكلية. إثبات أن ما تم بناؤه واختباره حدث فعلاً.

---

## 📄 License

MIT - See `LICENSE`

## 🔗 المراجع

- [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [Workflow execution protections](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/actions-policies/workflow-execution-protections)
```

echo "README 2026 updated"
