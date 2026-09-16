# @agi-system/sandbox

> Layer: AGI-OS 12-layer architecture

packages/sandbox - sandbox component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { SandboxService } from "@agi-system/sandbox";

const svc = new SandboxService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
