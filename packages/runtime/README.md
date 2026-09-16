# @agi-system/runtime

> Layer: AGI-OS 12-layer architecture

packages/runtime - runtime component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { RuntimeService } from "@agi-system/runtime";

const svc = new RuntimeService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
