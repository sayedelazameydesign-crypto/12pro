# Security

- Secret scanning: gitleaks + GitHub secret scanning
- Dependency audit: npm audit + Dependabot
- CodeQL: JS/TS analysis
- Container scan: Trivy
- No .env in repo - only .env.example

## Policy

- MAX_SPEND=0 default
- Sandbox isolation for tools
- Input validation via @agi-system/security
