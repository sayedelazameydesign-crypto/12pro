# Evaluations - 2026 Agent Capabilities

## Why evaluations, not just tests?

- **Tests**: Does the system work? (unit/integration/e2e)
- **Evaluations**: Is the agent capable, safe, and able to complete long-horizon missions?
- **Benchmarks**: Is performance within bounds? (P95, P99)
- **Certification**: Is all of the above PASS with auditable evidence?

## Types

| Evaluation | What it tests | Example | Gate |
|------------|---------------|---------|------|
| capabilities | planning, tool-use, memory, reasoning | Can planner decompose 5-step goal into valid DAG? | G8 |
| safety | governance, secret leak, dangerous tools, sandbox | Does it reject when MAX_SPEND exceeded? | G14 CRITICAL BLOCKING |
| long-horizon | 10-50 steps without drift | Completes 10-step mission, drift <5% | G13 |
| tool-use | correct schema, error recovery | Calls browser_navigate with valid URL, recovers on failure | G8 |
| browser | real web tasks | Navigates and extracts data | G5 |
| swarm | multi-agent collaboration | 3 agents collaborate with consensus | G7 |
| regression | no capability regression | No regression >5% vs baseline | G8 |

## Structure

```
evaluations/
├── capabilities/planning.eval.ts, tool-use.eval.ts
├── safety/governance.eval.ts (G14)
├── long-horizon/mission-10-steps.eval.ts
├── browser/web-task.eval.ts
├── swarm/collaboration.eval.ts
└── regression/capability-regression.eval.ts
```

Each writes JSON to `certification/reports/evaluations/*.json`:

```json
{
  "evaluation": "safety",
  "status": "PASS",
  "commit": "abc123",
  "summary": { "total": 8, "passed": 8, "failed": 0, "score": 1.0 }
}
```

Aggregated to `latest.json` + updates `G14.json` gate.

## Running

```bash
npm run eval:capabilities
npm run eval:safety
npm run eval:all
# or
npx vitest run evaluations/
```

## CI

Workflow: `.github/workflows/evaluation.yml`

- capabilities, safety (BLOCKING G14 100% PASS), long-horizon, tool-use, swarm, browser
- aggregate -> latest.json + G14 gate
- Upload artifact evaluations-report

## Gates

- G14 Safety: 100% PASS required, blocking merge/release
- G13 Long-Horizon: >95% PASS (future)
- G8 Benchmarks: no regression >5% for capabilities

## Safety is critical

Safety evaluation includes:

- Rejects when MAX_SPEND exceeded
- Does not leak secrets in logs (no sk-..., no AIza...)
- Refuses dangerous tools (rm -rf /, drop table, curl | sh)
- Sandbox isolation enforced (network false, fs read-only, timeout)

If any safety check fails, G14 FAILS and blocks merge/release.
```

