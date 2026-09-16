/**
 * @agi-system/autonomy - type definitions.
 *
 * Erasable-syntax-only: no enums (use `as const` + unions), no parameter properties.
 */

/** Observable autonomy level. Higher levels require strictly more evidence. */
export const AUTONOMY_LEVELS = ['L0_MANUAL', 'L1_ASSISTED', 'L2_SUPERVISED', 'L3_AUTONOMOUS'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface HealthSignal {
  name: string;
  status: HealthStatus;
  /** Measured value, if the signal is quantitative. */
  value?: number;
  /** Threshold the value was compared against. */
  threshold?: number;
  detail: string;
  checkedAt: string;
}

export interface HealthReport {
  status: HealthStatus;
  signals: HealthSignal[];
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  /** UNKNOWN signals are reported, never silently counted as healthy. */
  unknownCount: number;
}

/** An immutable, content-addressed snapshot of state that can be rolled back to. */
export interface Checkpoint {
  id: string;
  /** SHA-256 of the canonical serialized state. */
  stateHash: string;
  parentCheckpointId: string | null;
  label: string;
  createdAt: string;
  /** Serialized state. Kept in memory or handed to a store by the caller. */
  state: Record<string, unknown>;
}

export type RollbackOutcome = 'RESTORED' | 'NO_CHECKPOINT' | 'HASH_MISMATCH' | 'FAILED';

export interface RollbackResult {
  outcome: RollbackOutcome;
  fromCheckpointId: string | null;
  restoredStateHash: string | null;
  detail: string;
}

export type SelfHealingAction =
  | 'RESTART_COMPONENT'
  | 'ROLLBACK_CHECKPOINT'
  | 'DEGRADE_AUTONOMY'
  | 'ESCALATE_HUMAN'
  | 'NONE';

export interface HealingAttempt {
  action: SelfHealingAction;
  reason: string;
  attemptedAt: string;
  succeeded: boolean;
  detail: string;
}

/** Evidence that must exist before autonomy may be promoted. */
export interface PromotionEvidence {
  /** All required test suites ran and passed. */
  testsPassed: boolean;
  testSummary: { total: number; passed: number; failed: number; suites: string[] };
  /** Policy checks passed (spend ceiling, allowlist, no secrets). */
  policyPassed: boolean;
  policySummary: { maxSpendZero: boolean; noSecrets: boolean; checksRun: number; checksPassed: number };
  /** Evidence journal is present, hash-chained and verifiable. */
  evidenceBound: boolean;
  evidenceSummary: { entries: number; chainValid: boolean; commitBound: boolean };
  /** Health is not UNKNOWN and not UNHEALTHY. */
  health: HealthReport;
}

export type PromotionDecision = 'PROMOTE' | 'HOLD' | 'DEMOTE';

export interface PromotionResult {
  decision: PromotionDecision;
  from: AutonomyLevel;
  to: AutonomyLevel;
  reasons: string[];
  /** Every gate that was evaluated, with its verdict - no silent passes. */
  gates: { id: string; satisfied: boolean; detail: string }[];
  decidedAt: string;
}

export interface SupervisorConfig {
  level: AutonomyLevel;
  /** Maximum consecutive failures before autonomy is degraded. */
  maxConsecutiveFailures: number;
  /** Maximum healing attempts before escalating to a human. */
  maxHealingAttempts: number;
  /** Interval used by `tick` when driven externally. Informational. */
  healthIntervalMs: number;
}

export interface SupervisorEvent {
  type:
    | 'HEALTH_CHECK'
    | 'CHECKPOINT'
    | 'ROLLBACK'
    | 'HEALING'
    | 'PROMOTION'
    | 'DEMOTION'
    | 'ESCALATION';
  at: string;
  detail: string;
  payload?: Record<string, unknown>;
}
