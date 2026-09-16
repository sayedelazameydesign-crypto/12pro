# ADR 0007: Agent Runtime Lifecycle

- Date: 2026-09-16
- Status: Accepted

## Decision
Runtime lifecycle:
1. init() -> load governance, memory
2. plan() -> planner decomposes goal
3. execute() -> loop: tool -> observe -> memory write -> check governance
4. evaluate() -> scoring
5. certify() -> write gate JSON
6. shutdown()

Each phase emits OTEL span.
