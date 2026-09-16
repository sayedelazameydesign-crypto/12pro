# @agi-system/security

> Layer: AGI-OS 12-layer architecture

packages/security - security component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { SecurityService } from "@agi-system/security";

const svc = new SecurityService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
