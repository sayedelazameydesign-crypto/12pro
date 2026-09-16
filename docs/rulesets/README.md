# Rulesets - 2026 Branch & Tag Protection

## Overview

GitHub 2026 uses **Rulesets** instead of legacy branch protection. More flexible: can protect branches, tags, push, require status checks, signatures, deployment success, etc.

## Rulesets in this repo

### `main-branch.json` - main-branch-protection-2026

- **Target**: `refs/heads/main`
- **Enforcement**: active
- **Rules**:
  - No creation/deletion
  - No non-fast-forward
  - Require linear history
  - Require signed commits
  - Pull request: require CODEOWNERS review + 1 approval + resolve threads + dismiss stale reviews + require last push approval
  - Required status checks (strict):
    - lint, typecheck, unit-test, build
    - integration, contract, e2e
    - security/* (dependency-audit, codeql, secret-scanning)
    - evaluation/* (capabilities, safety)
    - supply-chain/* (sbom, provenance)
  - Commit message pattern: conventional commits `^(feat|fix|docs|chore|test|refactor|perf|security)(\(.+\))?: `
  - Branch name pattern: `^(main|develop|feat/.+|fix/.+|docs/.+|chore/.+|arena/.+)$`
- **Bypass**: Repository admin role always bypass (for emergency)

### `tags.json` - tag-protection-release

- **Target**: `refs/tags/v*.*.*`
- **Enforcement**: active
- **Rules**:
  - No deletion, no update
  - Require signed tags
  - Tag name pattern: SemVer `^v\d+\.\d+\.\d+(-[a-z0-9]+)?$`

### `security.json` - security-and-compliance-2026

- **Target**: default branch + main + develop
- **Enforcement**: active
- **Rules**:
  - Code scanning: CodeQL high threshold
  - Required status checks: dependency-audit, secret-scanning, sbom, provenance
  - Copilot code review on push

## How to apply

### Via UI

1. GitHub > Settings > Rules > Rulesets > New ruleset > Import from JSON
2. Paste content of `main-branch.json`, set enforcement active, create

### Via API

```bash
gh api repos/sayedelazameydesign-crypto/12pro/rulesets --method POST --input .github/rulesets/main-branch.json
```

### Via Terraform

```hcl
resource "github_repository_ruleset" "main" {
  name        = "main-branch-protection-2026"
  repository  = "12pro"
  target      = "branch"
  enforcement = "active"
  # ... see JSON
}
```

## Related

- Branch protection legacy: `.github/settings.yml` (probot)
- Environments: `.github/environments/` (staging, production)
- Workflows that enforce: `ci.yml`, `test.yml`, `e2e.yml`, `security.yml`, `evaluation.yml`, `attestation.yml`, `supply-chain.yml`
```

