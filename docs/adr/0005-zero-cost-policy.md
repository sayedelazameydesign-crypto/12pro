# ADR 0005: Zero-Cost Policy

- Date: 2026-09-16
- Status: Accepted

## Decision
System must run with MAX_SPEND=0 using Ollama local.

- All features must have local fallback
- CI uses Ollama mock, not real paid APIs
- Benchmarks run without paid APIs

## Rationale
Prevents accidental billing, enables offline dev.
