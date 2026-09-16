# @agi-system/skills

> Layer: AGI-OS 12-layer architecture

packages/skills - skills component.

## Responsibility

See `docs/architecture/` and `docs/adr/`.

## Usage

```ts
import { SkillsService } from "@agi-system/skills";

const svc = new SkillsService({ enabled: true });
await svc.init();
```

## Gates

This package must pass:

- G0: Build & Types
- G1: Unit Tests
- G2: Integration
- G3: Security

See `certification/gates/`.
