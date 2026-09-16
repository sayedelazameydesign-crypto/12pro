# RFC: Autonomous Missions

- Author: runtime-team
- Status: Draft
- Target: v1.5.0

## Summary
Enable long-running autonomous missions with self-healing.

## Design
- Mission queue in Redis
- Worker pool in services/worker
- Scheduler triggers cron missions
- Governance: max 10 steps auto, then require human approval

## Gates
- New gate G13: Long-Horizon PASS rate > 95%

## Open Questions
- How to handle human-in-the-loop?
