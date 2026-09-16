# Testing Strategy

```
Unit -> Integration -> Contract -> E2E -> Security -> Stress -> Chaos -> Long-Horizon -> Acceptance
```

- Unit: packages/*/src - vitest
- Integration: tests/integration - needs Postgres/Redis/Qdrant
- Contract: API shape
- E2E: Playwright
- Security: secret scanning + audit
- Stress: 100 concurrent
- Chaos: provider failure
- Acceptance: long-horizon missions

## Certification Gates

Each level maps to gate:

- G0: Build & Lint & Typecheck
- G1: Unit
- G2: Integration
- G3: Security
- G4: Contract
- G5: E2E
- G6: Stress
- G7: Chaos
- G8: Benchmarks
- G9: Acceptance
- G10: Governance
- G11: Docs
- G12: Release readiness
- G13: Long-Horizon (future)

See certification/gates/
