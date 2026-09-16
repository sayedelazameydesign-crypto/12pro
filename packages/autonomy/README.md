# `@agi-system/autonomy`

A supervised autonomy loop: health checks, checkpoints, rollback, escalating
self-healing, and promotion between autonomy levels that is gated on evidence.

```ts
import { createSupervisor, runHealthChecks, decidePromotion } from '@agi-system/autonomy';
```

The package is deliberately small and has **zero runtime dependencies**. It describes and
enforces *when a system may be trusted with more autonomy*, which is a policy question,
not an infrastructure one.

---

## Autonomy levels

```
L0_MANUAL  →  L1_ASSISTED  →  L2_SUPERVISED  →  L3_AUTONOMOUS
```

`nextLevel()` / `previousLevel()` move one step; `levelIndex()` orders them. Levels are
never skipped: a promotion decision always concerns the immediately adjacent level, so
there is no path from `L0_MANUAL` to `L3_AUTONOMOUS` that does not pass through the two
in between.

---

## Health

`runHealthChecks(probes)` evaluates registered `HealthProbe`s and `aggregateHealth()`
folds the signals into one `HealthReport`.

Statuses are `HEALTHY`, `DEGRADED`, `UNHEALTHY` and **`UNKNOWN`**. `UNKNOWN` is a
first-class value, not a default that quietly means healthy: `unknownSignal()` exists so
a probe that could not run is recorded as having not run. A report whose status is
`UNKNOWN` blocks promotion, because absence of evidence is not evidence.

---

## Checkpoints and rollback

`createCheckpointStore()` keeps `Checkpoint`s whose `checkpointId()` is derived from a
canonical hash of the state (`canonicalState()` / `hashState()`), so two checkpoints with
identical state are identical checkpoints and a tampered one does not validate.

`resolveRollbackTarget()` picks where to go back to and `rollback()` performs it,
returning a `RollbackResult` that says whether anything was actually restored. Rolling
back to a checkpoint that does not exist is a failure, not a no-op.

---

## Self-healing ladder

```
RESTART_COMPONENT  →  ROLLBACK_CHECKPOINT  →  DEGRADE_AUTONOMY  →  ESCALATE_HUMAN
```

`selectHealingAction(context)` chooses the lowest rung that is still available given the
`HealingContext`: the current health report, how many consecutive failures there have
been, what has already been attempted, and whether a checkpoint exists to roll back to.
`selfHeal()` executes it through the registered `HealingHandler`s.

Two properties matter:

- **Escalation is monotonic.** The ladder never retries a rung that has already failed,
  and it always terminates at `ESCALATE_HUMAN`. There is no unbounded self-repair loop.
- **Degrading autonomy is a healing action.** When the system cannot fix itself, the
  correct recovery is to take authority away, not to keep trying with the same authority.

---

## Supervisor

`createSupervisor(options)` returns a `Supervisor` driven by `tick(input)`. Each tick
collects health, decides whether healing is needed, and emits `SupervisorEvent`s.

```ts
const DEFAULT_SUPERVISOR_CONFIG = {
  level: 'L0_MANUAL',          // starts with the least authority, not the most
  maxConsecutiveFailures: 3,
  maxHealingAttempts: 4,       // == the ladder length, so every rung gets one try
  healthIntervalMs: 30_000,
};
```

The default level is `L0_MANUAL`. A supervisor that has proved nothing has no authority,
and must earn it.

---

## Promotion

`decidePromotion(current, evidence)` returns `PROMOTE`, `HOLD` or `DEMOTE`, together with
**every gate it evaluated and its verdict** — there are no silent passes.

Gates are evaluated over a `PromotionEvidence` record:

| Gate | Requires |
| --- | --- |
| `tests-passed` | All suites passed, `failed === 0`, `total > 0` |
| `tests-not-empty` | Tests actually ran — an empty suite is not evidence |
| `policy-passed` | The policy checks passed |
| `policy-max-spend-zero` | `MAX_SPEND=0` holds *(demoting)* |
| `policy-no-secrets` | No secret material *(demoting)* |
| `evidence-bound` | The evidence journal is present, hash-chained and commit-bound |
| `health-known` | Health is neither `UNKNOWN` nor `UNHEALTHY` |

Gates marked **demoting** do more than block a promotion: failing one triggers `DEMOTE`.
Exceeding the spend ceiling or leaking secret material removes authority rather than
merely withholding an increase.

`evidenceIsSubstantive(evidence)` runs before the gates and rejects evidence assembled
from placeholders — zero tests, no named suites, no policy checks, an empty journal, no
health signals. A promotion request built from nothing is refused at the door, which is
what stops a fabricated report from being laundered into an autonomy increase.

---

## Status

This package is **unit-tested, not deployed**. Its tests cover level ordering, health
aggregation including `UNKNOWN`, checkpoint identity and tamper detection, rollback to a
missing checkpoint, ladder escalation and termination, and every promotion gate including
the demoting ones.

Nothing in this repository currently runs a live supervised loop, and no promotion
decision recorded anywhere in `certification/` reflects a production system. Treat the
package as a specified, tested policy engine awaiting integration.
