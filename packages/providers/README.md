# @agi-system/providers

> Layer: AGI-OS 12-layer architecture

packages/providers - providers component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { ProvidersService } from "@agi-system/providers";

const svc = new ProvidersService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
