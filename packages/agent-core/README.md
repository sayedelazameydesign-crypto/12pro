# @agi-system/agent-core

> Layer: AGI-OS 12-layer architecture

packages/agent-core - agent-core component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { Agent-coreService } from "@agi-system/agent-core";

const svc = new Agent-coreService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
