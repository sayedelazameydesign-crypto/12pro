# @agi-system/orchestrator

> Layer: AGI-OS 12-layer architecture

packages/orchestrator - orchestrator component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { OrchestratorService } from "@agi-system/orchestrator";

const svc = new OrchestratorService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
