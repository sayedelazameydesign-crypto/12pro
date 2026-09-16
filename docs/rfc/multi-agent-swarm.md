# RFC: Multi-Agent Swarm

- Status: Draft
- Component: @agi-system/swarm

## Summary
Multiple agents collaborate via message bus.

## Design
- Leader election via Redis
- Consensus: simple majority for critical actions
- Messaging: pub/sub via Redis

## Benchmark
- swarm coordination latency P95 < 200ms
