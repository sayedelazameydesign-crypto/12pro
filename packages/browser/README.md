# @agi-system/browser

> Layer: AGI-OS 12-layer architecture

packages/browser - browser component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { BrowserService } from "@agi-system/browser";

const svc = new BrowserService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
