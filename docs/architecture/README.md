# AGI-OS Architecture

## 12-Layer Model

```
                         GitHub Repository
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
     SOURCE                   DOCS                    ISSUES
        │                       │                       │
        ▼                       ▼                       ▼
      Build                  ADR/RFC                  Tasks
        │
        ▼
       TESTS
        │
        ▼
   GitHub Actions
        │
   ┌────┼─────┬────────┬─────────┐
   ▼    ▼     ▼        ▼         ▼
  CI   E2E  Security Benchmark  Deploy
   │
   ▼
 Certification
   │
   ▼
 Pull Request
   │
   ▼
 Review / Policy
   │
   ▼
  Merge
   │
   ▼
 Release / Tag
   │
   ▼
 Packages / Artifacts
   │
   ▼
 Production
```

## 5 Interconnected Levels for AGI-OS

1. **Product**: Web / API / CLI (`apps/`)
2. **Agent Runtime**: Planner, Executor, Memory, Skills, Tools, Governance (`packages/`)
3. **Verification**: Unit, Integration, E2E, Stress, Security, Long-Horizon (`tests/`, `benchmarks/`)
4. **GitHub Engineering**: PR, Issues, Actions, Releases, Packages, Security (`.github/`)
5. **Evidence**: Gates, Benchmarks, Reports, Commit SHA, Artifacts (`certification/`)

## Core Packages

- `agent-core`: Agent, Mission, Task primitives
- `runtime`: Deterministic executor with lifecycle hooks
- `planner`: Hierarchical decomposition -> DAG
- `orchestrator`: Coordinates planner+runtime+memory+tools
- `swarm`: Multi-agent consensus
- `memory`: Vector + episodic + semantic
- `skills`: Composable capabilities
- `tools`: Function registry + validation
- `browser`: Playwright grounding
- `sandbox`: gVisor isolation
- `governance`: Policy engine (spend, allowlist)
- `security`: Secret scanning, validation
- `providers`: LLM routing with fallback
- `observability`: OTEL tracing
- `evaluation`: Benchmark harness

## Data Flow

```
User Goal
  -> API Server (governance check)
  -> Orchestrator
  -> Planner (decompose)
  -> Runtime (execute per step)
     -> Tools / Browser / Skills
     -> Memory (read/write)
     -> Providers (LLM call)
  -> Evaluation (score)
  -> Certification (gate)
  -> Response
```

## GitHub as Agent Workspace

GitHub is not just git server - it's agent workspace via Webhooks:

```
GitHub Push/PR/Issue/Release -> Webhook -> AGI Runtime -> analyze/plan/test/review/report -> PR Comment / Issue Update
```

## Verification Pipeline

```
Unit
  ↓
Integration
  ↓
Contract
  ↓
E2E
  ↓
Security
  ↓
Stress
  ↓
Chaos
  ↓
Long-Horizon
  ↓
Acceptance
```
