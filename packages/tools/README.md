# @agi-system/tools

> Layer: AGI-OS 12-layer architecture

packages/tools - tools component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { ToolsService } from "@agi-system/tools";

const svc = new ToolsService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
