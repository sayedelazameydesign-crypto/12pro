# @agi-system/memory

> Layer: AGI-OS 12-layer architecture

packages/memory - memory component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { MemoryService } from "@agi-system/memory";

const svc = new MemoryService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
