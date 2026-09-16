# Environments - Staging & Production (2026)

## Overview

GitHub Environments provide deployment protection: required reviewers, wait timers, branch policies, secrets, variables, and now **attestations required**.

## Staging

File: `.github/environments/staging.yml` (documentation, real config in GitHub UI)

- **Protection**: No required reviewers, wait 0
- **Branches**: main, develop, arena/* allowed
- **Variables**: API_URL=https://staging..., LOG_LEVEL=debug, RUNTIME_MODE=docker, OTEL_ENABLED=true
- **Secrets**: DATABASE_URL, REDIS_URL, VECTOR_DB_URL, OLLAMA_BASE_URL, JWT_SECRET, ENCRYPTION_KEY (set in UI, never in repo)
- **Attestations**: false (not required for staging)
- **Deployment**: Auto on push to main via `deploy.yml`

## Production

File: `.github/environments/production.yml`

- **Protection**:
  - Required reviewers: governance-team + security-team
  - Wait timer: 5 minutes
  - Deployment branches: protected only (tags v*.*.*)
- **Variables**: API_URL=https://api..., LOG_LEVEL=info, RUNTIME_MODE=gvisor, OTEL_ENABLED=true, TRACING_SAMPLING=0.1
- **Secrets**: All staging + GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, NPM_TOKEN, GITHUB_TOKEN (set in UI)
- **Attestations**:
  - required: true
  - provenance: true
  - sbom: true
- **Checks**:
  - Gates: G0,G1,G2,G3,G4,G5,G6,G7,G14 must PASS
  - Benchmarks: no regression >10%
  - Attestation: required
  - SBOM: required
- **Deployment**: Only on tag v*.*.* via `deploy.yml` + manual approval

## How to configure in GitHub UI

1. Settings > Environments > New environment > Name: `staging`
2. No protection rules, add deployment branches: main, develop, arena/*
3. Add variables and secrets as per yml
4. Repeat for `production` with protection rules: required reviewers, wait timer, deployment branches protected only
5. Enable: Required reviewers, Wait timer, Deployment branches

## Workflows

- `deploy.yml`: Uses `environment: staging` and `environment: production`
- `release.yml`: Publishes with provenance, required for production

## Verification

```bash
# Check deployment
gh api repos/sayedelazameydesign-crypto/12pro/environments

# Check attestation for production image
gh attestation verify oci://ghcr.io/sayedelazameydesign-crypto/12pro:v0.1.0 --owner sayedelazameydesign-crypto
```
```

