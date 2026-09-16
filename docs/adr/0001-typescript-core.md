# ADR 0001: TypeScript as Core Language

- Date: 2026-09-16
- Status: Accepted
- Deciders: architecture-team

## Context
Need type safety for agent runtime, governance, tool validation.

## Decision
Use TypeScript 5.5+ with strict mode, composite projects, NodeNext module.

## Consequences
- Build requires tsc -b
- All packages export ESM
- Type checks are blocking gate (G0)

## Gates
- G0: typecheck must PASS
