# RFC: Self-Healing

- Status: Draft

## Summary
Agent detects failure and replans automatically.

## Design
- On tool failure: retry with exponential backoff
- On planner failure: fallback to simpler decomposition
- On provider failure: route to next provider
- All healing attempts logged to observability

## Gate
- Chaos tests must PASS: kill random service, system recovers
