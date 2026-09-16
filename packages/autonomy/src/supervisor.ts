/**
 * Supervisor: the control loop that makes autonomy safe.
 *
 * Each `tick` performs, in order:
 *   1. health check      - and UNKNOWN is never treated as healthy
 *   2. checkpoint        - a hash-verified snapshot before any risky action
 *   3. self-healing      - bounded ladder, always terminating in escalation
 *   4. promotion/demotion - decided only from tests AND policy AND evidence
 *
 * Every step appends to an immutable event log, so the supervisor's own behaviour
 * is auditable after the fact rather than only observable while it runs.
 */
import { createCheckpointStore, hashState } from './checkpoint.ts';
import { runHealthChecks } from './health.ts';
import { rollback } from './rollback.ts';
import { selfHeal } from './self-healing.ts';
import { decidePromotion, evidenceIsSubstantive } from './promotion.ts';
import { AUTONOMY_LEVELS } from './types.ts';
import type {
  AutonomyLevel,
  Checkpoint,
  HealthReport,
  HealingAttempt,
  PromotionEvidence,
  PromotionResult,
  RollbackResult,
  SupervisorConfig,
  SupervisorEvent,
} from './types.ts';
import type { HealthProbe } from './health.ts';
import type { HealingHandler } from './self-healing.ts';

export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = {
  level: 'L0_MANUAL',
  maxConsecutiveFailures: 3,
  maxHealingAttempts: 4,
  healthIntervalMs: 30_000,
};

export interface SupervisorOptions {
  config?: Partial<SupervisorConfig>;
  probes?: readonly HealthProbe[];
  healingHandlers?: readonly HealingHandler[];
}

export interface TickInput {
  /** State to checkpoint before acting. */
  state: Record<string, unknown>;
  /** Evidence required for a promotion decision. Absent means "do not promote". */
  promotionEvidence?: PromotionEvidence;
  /** Force a failure count increment (e.g. the supervised action failed). */
  recordFailure?: boolean;
  checkpointLabel?: string;
}

export interface TickResult {
  level: AutonomyLevel;
  health: HealthReport;
  checkpoint: Checkpoint;
  healing: { resolved: boolean; escalated: boolean; attempts: HealingAttempt[]; detail: string };
  rollback: (RollbackResult & { state: Record<string, unknown> | null }) | null;
  promotion: PromotionResult | null;
  events: SupervisorEvent[];
}

export interface Supervisor {
  readonly level: AutonomyLevel;
  readonly events: readonly SupervisorEvent[];
  readonly consecutiveFailures: number;
  tick(input: TickInput): Promise<TickResult>;
  setLevel(level: AutonomyLevel, reason: string): void;
  store(): ReturnType<typeof createCheckpointStore>;
}

function isLevel(value: unknown): value is AutonomyLevel {
  return typeof value === 'string' && (AUTONOMY_LEVELS as readonly string[]).includes(value);
}

/** Create a supervisor. Autonomy starts at whatever level is configured, never higher. */
export function createSupervisor(options: SupervisorOptions = {}): Supervisor {
  const config: SupervisorConfig = { ...DEFAULT_SUPERVISOR_CONFIG, ...(options.config ?? {}) };
  if (!isLevel(config.level)) {
    throw new TypeError(`createSupervisor: invalid autonomy level ${String(config.level)}`);
  }

  const probes = options.probes ?? [];
  const healingHandlers = options.healingHandlers ?? [];
  const checkpoints = createCheckpointStore();

  let level: AutonomyLevel = config.level;
  let consecutiveFailures = 0;
  const events: SupervisorEvent[] = [];

  const record = (event: Omit<SupervisorEvent, 'at'>): SupervisorEvent => {
    const full: SupervisorEvent = { ...event, at: new Date().toISOString() };
    events.push(full);
    return full;
  };

  const supervisor: Supervisor = {
    get level(): AutonomyLevel {
      return level;
    },

    get events(): readonly SupervisorEvent[] {
      return [...events];
    },

    get consecutiveFailures(): number {
      return consecutiveFailures;
    },

    store() {
      return checkpoints;
    },

    setLevel(next: AutonomyLevel, reason: string): void {
      if (!isLevel(next)) throw new TypeError(`setLevel: invalid level ${String(next)}`);
      const from = level;
      level = next;
      record({
        type: AUTONOMY_LEVELS.indexOf(next) < AUTONOMY_LEVELS.indexOf(from) ? 'DEMOTION' : 'PROMOTION',
        detail: `${from} -> ${next}: ${reason}`,
        payload: { from, to: next },
      });
    },

    async tick(input: TickInput): Promise<TickResult> {
      const tickEvents: SupervisorEvent[] = [];

      // 1. health
      const health = await runHealthChecks(probes);
      tickEvents.push(
        record({
          type: 'HEALTH_CHECK',
          detail: `status=${health.status} healthy=${health.healthyCount} degraded=${health.degradedCount} unhealthy=${health.unhealthyCount} unknown=${health.unknownCount}`,
          payload: { status: health.status },
        }),
      );

      // 2. checkpoint before acting
      const checkpoint = checkpoints.take(input.state, input.checkpointLabel ?? 'pre-action');
      tickEvents.push(
        record({
          type: 'CHECKPOINT',
          detail: `checkpoint ${checkpoint.id} ("${checkpoint.label}") stateHash=${checkpoint.stateHash.slice(0, 12)}...`,
          payload: { checkpointId: checkpoint.id, stateHash: checkpoint.stateHash },
        }),
      );

      if (input.recordFailure) {
        consecutiveFailures += 1;
      } else if (health.status === 'HEALTHY') {
        consecutiveFailures = 0;
      }

      // 3. self-healing when not healthy, or when failures accumulate
      let healing: TickResult['healing'];
      let rollbackResult: TickResult['rollback'] = null;

      const needsHealing = health.status !== 'HEALTHY' || consecutiveFailures >= 1;

      if (needsHealing) {
        const healingOutcome = await selfHeal(
          {
            health,
            consecutiveFailures,
            attemptsSoFar: [],
            checkpointAvailable: checkpoints.list().length > 1,
          },
          [
            // Built-in rollback handler: the supervisor knows how to restore.
            {
              action: 'ROLLBACK_CHECKPOINT',
              run: () => {
                const result = rollback(checkpoints);
                rollbackResult = result;
                tickEvents.push(
                  record({
                    type: 'ROLLBACK',
                    detail: `${result.outcome}: ${result.detail}`,
                    payload: { outcome: result.outcome },
                  }),
                );
                return result.outcome === 'RESTORED';
              },
            },
            ...healingHandlers,
          ],
          config.maxHealingAttempts,
        );

        healing = {
          resolved: healingOutcome.resolved,
          escalated: healingOutcome.escalated,
          attempts: healingOutcome.attempts,
          detail: healingOutcome.detail,
        };

        for (const attempt of healingOutcome.attempts) {
          tickEvents.push(
            record({
              type: attempt.action === 'ESCALATE_HUMAN' ? 'ESCALATION' : 'HEALING',
              detail: `${attempt.action} succeeded=${attempt.succeeded}: ${attempt.detail}`,
              payload: { action: attempt.action, succeeded: attempt.succeeded },
            }),
          );
        }

        // Escalation always costs autonomy: a system that needed a human is not
        // entitled to keep the level it was operating at.
        if (healingOutcome.escalated && level !== 'L0_MANUAL') {
          const from = level;
          level = 'L0_MANUAL';
          consecutiveFailures = 0;
          tickEvents.push(
            record({
              type: 'DEMOTION',
              detail: `${from} -> L0_MANUAL: healing escalated to human`,
              payload: { from, to: level },
            }),
          );
        }
      } else {
        healing = { resolved: true, escalated: false, attempts: [], detail: 'no healing required' };
      }

      // Hard failure ceiling: degrade regardless of healing outcome.
      if (consecutiveFailures >= config.maxConsecutiveFailures && level !== 'L0_MANUAL') {
        const from = level;
        level = 'L0_MANUAL';
        tickEvents.push(
          record({
            type: 'DEMOTION',
            detail: `${from} -> L0_MANUAL: ${consecutiveFailures} consecutive failures reached the ceiling of ${config.maxConsecutiveFailures}`,
            payload: { from, to: level },
          }),
        );
        consecutiveFailures = 0;
      }

      // 4. promotion - only from substantive evidence
      let promotion: PromotionResult | null = null;
      if (input.promotionEvidence) {
        const substantive = evidenceIsSubstantive(input.promotionEvidence);
        if (!substantive.substantive) {
          promotion = {
            decision: 'HOLD',
            from: level,
            to: level,
            reasons: [
              'evidence is not substantive - refusing to promote on placeholder data',
              ...substantive.problems,
            ],
            gates: [
              {
                id: 'evidence-substantive',
                satisfied: false,
                detail: substantive.problems.join('; '),
              },
            ],
            decidedAt: new Date().toISOString(),
          };
        } else {
          promotion = decidePromotion(level, input.promotionEvidence);
          if (promotion.decision === 'PROMOTE' && promotion.to !== level) {
            const from = level;
            level = promotion.to;
            promotion = { ...promotion, from };
          }
        }
        tickEvents.push(
          record({
            type: promotion.decision === 'DEMOTE' ? 'DEMOTION' : 'PROMOTION',
            detail: `${promotion.decision} ${promotion.from} -> ${promotion.to}: ${promotion.reasons[0] ?? ''}`,
            payload: { decision: promotion.decision, to: promotion.to },
          }),
        );
        if (promotion.decision === 'DEMOTE' && promotion.to !== level) {
          level = promotion.to;
        }
      }

      return {
        level,
        health,
        checkpoint,
        healing,
        rollback: rollbackResult,
        promotion,
        events: tickEvents,
      };
    },
  };

  return supervisor;
}

export { hashState };
