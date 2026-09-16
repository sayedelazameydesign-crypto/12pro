# @agi-system/governance

> Layer: AGI-OS 12-layer architecture

packages/governance - governance component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { GovernanceService } from "@agi-system/governance";

const svc = new GovernanceService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
