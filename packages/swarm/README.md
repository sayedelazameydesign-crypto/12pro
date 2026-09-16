# @agi-system/swarm

> Layer: AGI-OS 12-layer architecture

packages/swarm - swarm component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { SwarmService } from "@agi-system/swarm";

const svc = new SwarmService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
