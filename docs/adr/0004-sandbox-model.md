# ADR 0004: Sandbox Execution Model

- Date: 2026-09-16
- Status: Accepted

## Decision
All tool execution goes through @agi-system/sandbox:
- Default: docker isolation
- Option: gVisor for stronger isolation
- Resource limits: CPU, mem, timeout, no network by default

## Security
- No secrets passed to sandbox unless allowlisted
- Audit log per tool call
