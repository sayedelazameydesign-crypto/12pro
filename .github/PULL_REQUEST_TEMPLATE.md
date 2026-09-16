# Pull Request

## Summary
<!-- What does this PR change? Link Issue: Closes #... -->

## 12-Layer Checklist
- [ ] **1. Source Code**: Code in `apps/`, `packages/`, `services/` follows architecture
- [ ] **2. Tests**: Added/updated tests in `tests/` (unit/integration/e2e/security/...)
- [ ] **3. CI/CD**: `.github/workflows/` passes locally (`npm run lint && npm run typecheck && npm run test`)
- [ ] **4. Automation**: No manual steps; automation updated if needed
- [ ] **5. Issues**: Linked to Issue / Task
- [ ] **6. PR Quality**: Self-reviewed, small & focused
- [ ] **7. Releases**: CHANGELOG updated if user-facing
- [ ] **8. Security**: No secrets, `npm audit` clean, input validation
- [ ] **9. Documentation**: `docs/` and README updated, ADR added if decision
- [ ] **10. Configuration**: `.env.example` updated, configs for dev/test/prod
- [ ] **11. Packages**: Version bump if package changed
- [ ] **12. Governance & Evidence**: Certification gates updated, evidence attached

## Gates (Must Pass)
> Merge blocked unless all required gates PASS

```
Lint       ⏳
Typecheck  ⏳
Unit       ⏳
Integration⏳
E2E        ⏳
Security   ⏳
Build      ⏳
Benchmark  (info)
```

## Evidence
- Commit SHA: `<!-- CI will fill -->`
- Certification: `certification/reports/*.json`
- Benchmark diff: <!-- if any -->

## Screenshots / Logs
<!-- Paste -->

## Breaking Changes
<!-- List or None -->

## Reviewers
<!-- @runtime-team @security-team etc per CODEOWNERS -->
