/**
 * Self-healing.
 *
 * Healing is a bounded, ordered ladder. Each rung is attempted only when the one
 * above it did not resolve the problem, and the ladder ALWAYS terminates in
 * ESCALATE_HUMAN. Autonomy that cannot heal itself must hand control back rather
 * than retry forever or silently continue in a broken state.
 */
import type { HealthReport, HealingAttempt, SelfHealingAction } from './types.ts';

/** Ordered healing ladder, least to most disruptive. */
export const HEALING_LADDER: readonly SelfHealingAction[] = [
  'RESTART_COMPONENT',
  'ROLLBACK_CHECKPOINT',
  'DEGRADE_AUTONOMY',
  'ESCALATE_HUMAN',
];

export interface HealingContext {
  health: HealthReport;
  consecutiveFailures: number;
  attemptsSoFar: HealingAttempt[];
  /** True when a checkpoint exists that rollback could restore. */
  checkpointAvailable: boolean;
}

export interface HealingHandler {
  action: SelfHealingAction;
  /** Attempt the action. Return true when the problem is considered resolved. */
  run(context: HealingContext): Promise<boolean> | boolean;
}

/** Choose the next action from the ladder given the current context. */
export function selectHealingAction(context: HealingContext): {
  action: SelfHealingAction;
  reason: string;
} {
  const { health, consecutiveFailures, attemptsSoFar, checkpointAvailable } = context;

  const tried = new Set(attemptsSoFar.map((a) => a.action));

  if (health.status === 'HEALTHY' && consecutiveFailures === 0) {
    return { action: 'NONE', reason: 'no healing required - system is healthy' };
  }

  // UNKNOWN health means we do not actually know what is wrong. Restarting blind
  // is not justified; escalate instead of guessing.
  if (health.status === 'UNKNOWN') {
    return {
      action: 'ESCALATE_HUMAN',
      reason: `${health.unknownCount} health signal(s) are UNKNOWN - cannot safely self-heal without knowing what failed`,
    };
  }

  if (!tried.has('RESTART_COMPONENT') && health.status === 'DEGRADED') {
    return { action: 'RESTART_COMPONENT', reason: 'degraded health - attempting component restart first' };
  }

  if (!tried.has('ROLLBACK_CHECKPOINT') && checkpointAvailable) {
    return { action: 'ROLLBACK_CHECKPOINT', reason: 'unhealthy or repeated failure - rolling back to last good checkpoint' };
  }

  if (!tried.has('DEGRADE_AUTONOMY')) {
    return {
      action: 'DEGRADE_AUTONOMY',
      reason: `${consecutiveFailures} consecutive failure(s) and no checkpoint recovery available - reducing autonomy`,
    };
  }

  return {
    action: 'ESCALATE_HUMAN',
    reason: 'healing ladder exhausted - handing control back to a human',
  };
}

export interface SelfHealingResult {
  resolved: boolean;
  attempts: HealingAttempt[];
  escalated: boolean;
  detail: string;
}

/**
 * Drive the healing ladder to completion.
 *
 * `maxAttempts` bounds the loop; the ladder always ends at ESCALATE_HUMAN, so a
 * caller that supplies no handler for it still gets a terminal, honest outcome.
 */
export async function selfHeal(
  context: HealingContext,
  handlers: readonly HealingHandler[],
  maxAttempts = 4,
): Promise<SelfHealingResult> {
  const attempts: HealingAttempt[] = [...context.attemptsSoFar];
  let current: HealingContext = { ...context, attemptsSoFar: attempts };

  for (let i = 0; i < maxAttempts; i++) {
    const { action, reason } = selectHealingAction(current);

    if (action === 'NONE') {
      return { resolved: true, attempts, escalated: false, detail: reason };
    }

    const handler = handlers.find((h) => h.action === action);

    if (action === 'ESCALATE_HUMAN') {
      attempts.push({
        action,
        reason,
        attemptedAt: new Date().toISOString(),
        succeeded: false,
        detail: handler ? 'escalation handler invoked' : 'no escalation handler registered',
      });
      if (handler) await handler.run(current);
      return {
        resolved: false,
        attempts,
        escalated: true,
        detail: `escalated to human: ${reason}`,
      };
    }

    if (!handler) {
      attempts.push({
        action,
        reason,
        attemptedAt: new Date().toISOString(),
        succeeded: false,
        detail: 'no handler registered for this action',
      });
      current = { ...current, attemptsSoFar: attempts };
      continue;
    }

    let succeeded = false;
    let detail = '';
    try {
      succeeded = await handler.run(current);
      detail = succeeded ? 'handler reported success' : 'handler reported no improvement';
    } catch (err) {
      succeeded = false;
      detail = `handler threw: ${(err as Error).message}`;
    }

    attempts.push({ action, reason, attemptedAt: new Date().toISOString(), succeeded, detail });
    current = { ...current, attemptsSoFar: attempts };

    if (succeeded) {
      return { resolved: true, attempts, escalated: false, detail: `${action} resolved the problem` };
    }
  }

  return {
    resolved: false,
    attempts,
    escalated: true,
    detail: `healing budget of ${maxAttempts} attempts exhausted without resolution - escalation required`,
  };
}
