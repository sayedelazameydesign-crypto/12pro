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

- G13 Long-Horizon full implementation
- Browser agent vision grounding
- Multi-agent swarm consensus
- Self-healing runtime
