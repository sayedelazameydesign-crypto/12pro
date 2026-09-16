# @agi-system/observability

> Layer: AGI-OS 12-layer architecture

packages/observability - observability component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { ObservabilityService } from "@agi-system/observability";

const svc = new ObservabilityService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
