# @agi-system/evaluation

> Layer: AGI-OS 12-layer architecture

packages/evaluation - evaluation component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { EvaluationService } from "@agi-system/evaluation";

const svc = new EvaluationService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
