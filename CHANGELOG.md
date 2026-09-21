# Changelog

All notable changes to AGI-OS will be documented here.

Format based on Keep a Changelog.

## [0.1.0] - 2026-09-16

### Added
- Initial 12-layer professional repository blueprint
- **Layer 1 Source Code**: `apps/` (web, api, agent-ui), `packages/` (15 packages), `services/` (4 services)
- **Layer 2 Tests**: `tests/` (unit, integration, contract, e2e, regression, stress, chaos, security, browser, acceptance)
- **Layer 3 CI/CD**: `.github/workflows/` (ci.yml, test.yml, e2e.yml, security.yml, benchmark.yml, release.yml, deploy.yml)
- **Layer 4 Automation**: Issue templates (bug, feature, task), PR template with 12-layer checklist, CODEOWNERS, dependabot
- **Layer 5 Issues**: Workflow Idea->Issue->Task->Branch->PR->CI->Review->Merge->Release
- **Layer 6 PRs**: Required gates Lint/Typecheck/Unit/Integration/E2E/Security/Build
- **Layer 7 Releases**: Tag + SHA + Tests + Artifacts + CHANGELOG + Certification manifest
- **Layer 8 Security**: Dependabot, CodeQL, gitleaks, Trivy, npm audit, sandbox isolation
- **Layer 9 Documentation**: README, docs/architecture, docs/adr (7 ADRs), docs/rfc (4 RFCs), docs/api, operations, security, testing, deployment
- **Layer 10 Configuration**: `.env.example` zero-cost policy, configs/development/test/production
- **Layer 11 Packages**: npm workspaces @agi-system/*, Docker GHCR, Turbo monorepo
- **Layer 12 Governance & Evidence**: certification/gates (G0-G13), reports, benchmarks, manifests with commit SHA

### Security
- Zero-cost policy MAX_SPEND=0, no secrets in repo, sandbox execution

### Evidence
- Commit: e4444dab733e22318d9253707a39734fbb581d03
- Gates: 14 PASS
- Benchmarks: latency P95 180ms, memory 120MB

## [Unreleased]

### Added
- **Knowledge Base layer** `@agi-system/knowledge` (`packages/knowledge/`) - authored, versioned,
  bilingual (ar/en) knowledge the agent can retrieve, quote, quiz on and remember. Zero runtime
  dependencies, like `@agi-system/cognition`.
- **First curriculum `ml-from-zero`** - "Machine Learning من الصفر": 8 stages, 16 lessons,
  49 glossary terms, 26 quizzes, following Problem → Data → Model → Prediction → Loss →
  Optimization → Evaluation → Iteration (built from a summary of Andrew Ng's framing).
- **8 runnable labs** in `examples/ml-course/` (pure Python, no third-party packages) plus
  `run_all.py` which reports 8/8 PASS with machine-readable `RESULT` evidence lines.
- **Bilingual retrieval** - Arabic normalization, light English stemming, IDF-weighted overlap and
  curated glossary aliases (`دالة الخطأ` → `loss-function`), with a deterministic 384-dim hash
  embedding compatible with `memory-fabric` EMBEDDING_CONFIG.
- **Memory + skills integration** - `KnowledgeBase.ingestInto(memoryFabric)` persists 73 records
  (16 lessons + 49 terms as `semantic`, 8 stages as `procedural`, idempotent ids);
  `toSkillCandidates()` yields one lab skill per lesson for the skills-registry pipeline.
- **Control Plane API** - `GET /api/v1/knowledge`, `/knowledge/search`, `/knowledge/lessons/{id}`,
  `/knowledge/stages/{id}`, `/knowledge/terms`, `/knowledge/context` serving the real authored files
  (503 with a reason if unavailable, never mocks; quizzes served without the answer key).
- **Docs** - `docs/knowledge/README.md`, `packages/knowledge/README.md`,
  `packages/knowledge/data/ml-from-zero/README.md`, `examples/ml-course/README.md`,
  `docs/api/README.md` + `docs/api/openapi.yaml` knowledge paths.

### Tests
- `tests/unit/knowledge/` - 32 tests: content invariants (bilingual coverage, stage/lesson/term/quiz
  consistency, lab paths), retrieval behaviour, context packing, progress, memory ingestion, and the
  8 Python labs (skipped automatically when no Python interpreter is present).
- `tests/integration/knowledge-api.test.ts` - 7 tests: boots the real API server on an ephemeral port
  and exercises all six knowledge routes, including the "no answer key over the API" rule.

### Changed
- `services/api-server` - the SSE heartbeat timer is now tracked and `unref()`ed, and
  `stopApiServer()` is exported for graceful shutdown (tests and SIGTERM), so the heartbeat can never
  keep a process alive on its own.

- G13 Long-Horizon full implementation
- Browser agent vision grounding
- Multi-agent swarm consensus
- Self-healing runtime
