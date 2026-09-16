# @agi-system/planner

> Layer: AGI-OS 12-layer architecture

packages/planner - planner component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { PlannerService } from "@agi-system/planner";

const svc = new PlannerService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
