# ADR 0003: LLM Provider Routing

- Date: 2026-09-16
- Status: Accepted

## Decision
@agi-system/providers implements routing with fallback:
Gemini -> Groq -> OpenAI -> Ollama local

Policy: MAX_SPEND=0 by default (zero-cost policy).

## Consequences
- .env.example must list all provider keys empty
- Governance checks spend before each call
- Ollama is default for local dev

## Gates
- G3 Security: no secret in code
- Benchmark: provider fallback < 2s
