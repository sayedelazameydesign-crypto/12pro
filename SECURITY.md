# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

- Do NOT open public Issue
- Email: security@agi-system.local (placeholder) or use GitHub Security Advisories
- Include: affected component, reproduction, commit SHA, impact

We aim to respond within 48h.

## Security Layers in Repository

This repo implements 8th layer: Security

### Automated Checks

- **Dependabot**: weekly npm, docker, github-actions updates (`.github/dependabot.yml`)
- **CodeQL**: JS/TS analysis on every PR (`security.yml`)
- **Secret Scanning**: gitleaks + GitHub secret scanning
- **Container Scan**: Trivy FS scan
- **npm audit**: high severity blocks CI

### Secret Management

```
.env.example          -> committed, empty values
.env                  -> NEVER committed, local only
GitHub Actions Secrets -> for CI: GEMINI_API_KEY, etc.
Production Secrets     -> via env vars / vault, not in repo
```

Check `.env.example` - all keys empty.

### Sandbox

- `@agi-system/sandbox` isolates tool execution
- Default: no network, limited CPU/mem, timeout 60s
- Audit log per tool call via `@agi-system/observability`

### Governance

- `@agi-system/governance` enforces:
  - MAX_SPEND=0 default
  - Allowlist for tools
  - Approval required over threshold
- CODEOWNERS requires security-team review for:
  - `/packages/security/`
  - `/packages/sandbox/`
  - `/packages/governance/`
  - `/services/`
  - `/.github/`

### Branch Protection (to be configured in GitHub settings)

- `main`:
  - PR required
  - CI required (ci.yml, test.yml, security.yml)
  - CODEOWNERS review required
  - No force push
  - Require signed commits (recommended)

## Verification

```bash
npm run test:security
npx gitleaks detect --source .
npm audit --audit-level=high
```
