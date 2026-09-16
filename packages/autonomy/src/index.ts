/**
 * @agi-system/autonomy
 *
 * Supervised autonomy: health checks, checkpoints, hash-verified rollback,
 * bounded self-healing that always terminates in human escalation, and promotion
 * that requires tests AND policy AND evidence.
 *
 * Non-negotiable rules encoded here:
 *   - an UNKNOWN health signal is never counted as healthy
 *   - an empty test suite is never accepted as evidence
 *   - rollback refuses to restore state whose hash does not match its checkpoint
 *   - the healing ladder always ends at ESCALATE_HUMAN, and escalation costs autonomy
 *   - promotion is single-step up a strictly ordered ladder
 *
 * Erasable-syntax-only TypeScript: runs directly under Node >= 22.6.
 */

export * from './types.ts';
export * from './health.ts';
export * from './checkpoint.ts';
export * from './rollback.ts';
export * from './self-healing.ts';
export * from './promotion.ts';
export * from './supervisor.ts';

export const PACKAGE_NAME = '@agi-system/autonomy';
export const VERSION = '0.1.0';
