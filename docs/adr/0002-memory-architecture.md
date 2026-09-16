# ADR 0002: Memory Architecture

- Date: 2026-09-16
- Status: Accepted

## Context
Agents need long-term memory beyond context window.

## Decision
Three-tier memory:
- Short-term: in-memory LRU
- Episodic: Postgres + pgvector
- Semantic: Qdrant vector DB

Abstraction in @agi-system/memory with backend pluggable.

## Consequences
- Requires VECTOR_DB_URL, DATABASE_URL
- Benchmark: memory read < 50ms P95

## Verification
- tests/integration/memory.test.ts
- benchmarks/memory/
