/**
 * Evidence-gated promotion.
 *
 * Autonomy is promoted ONLY when tests AND policy AND evidence all hold. Every
 * gate is evaluated and reported - there is no path by which a missing check
 * becomes an implicit pass, and no path by which UNKNOWN health is promoted.
 *
 * The ladder is strictly ordered and single-step: L0 -> L1 -> L2 -> L3. A system
 * can never jump two levels, because each level's evidence presupposes the
 * previous one.
 */
import { AUTONOMY_LEVELS } from './types.ts';
import type { AutonomyLevel, PromotionEvidence, PromotionResult } from './types.ts';

/** Index of a level in the ladder. */
export function levelIndex(level: AutonomyLevel): number {
  return AUTONOMY_LEVELS.indexOf(level);
}

/** The next level up, or null at the top of the ladder. */
export function nextLevel(level: AutonomyLevel): AutonomyLevel | null {
  const index = levelIndex(level);
  if (index === -1 || index >= AUTONOMY_LEVELS.length - 1) return null;
  return AUTONOMY_LEVELS[index + 1] ?? null;
}

/** The next level down, or null at the bottom. */
export function previousLevel(level: AutonomyLevel): AutonomyLevel | null {
  const index = levelIndex(level);
  if (index <= 0) return null;
  return AUTONOMY_LEVELS[index - 1] ?? null;
}

interface Gate {
  id: string;
  satisfied: boolean;
  detail: string;
  /** When true, failing this gate demotes rather than merely holding. */
  demoting?: boolean;
}

/**
 * Evaluate every promotion gate against real evidence.
 *
 * Returns the full gate list so a HOLD is always explainable: the caller can see
 * exactly which requirement was unmet instead of receiving a bare "no".
 */
export function evaluatePromotionGates(
  current: AutonomyLevel,
  evidence: PromotionEvidence,
): { gates: Gate[]; target: AutonomyLevel | null } {
  const target = nextLevel(current);
  const gates: Gate[] = [];

  const { testsPassed, testSummary, policyPassed, policySummary, evidenceBound, evidenceSummary, health } =
    evidence;

  gates.push({
    id: 'tests-passed',
    satisfied: testsPassed && testSummary.failed === 0 && testSummary.total > 0,
    detail: `${testSummary.passed}/${testSummary.total} passed, ${testSummary.failed} failed across [${testSummary.suites.join(', ')}]`,
  });

  gates.push({
    id: 'tests-not-empty',
    satisfied: testSummary.total > 0,
    detail: testSummary.total > 0 ? `${testSummary.total} test(s) actually ran` : 'no tests ran - an empty suite is not evidence',
  });

  gates.push({
    id: 'policy-passed',
    satisfied: policyPassed,
    detail: `${policySummary.checksPassed}/${policySummary.checksRun} policy checks passed`,
  });

  gates.push({
    id: 'policy-max-spend-zero',
    satisfied: policySummary.maxSpendZero,
    detail: policySummary.maxSpendZero ? 'MAX_SPEND=0 enforced' : 'MAX_SPEND is not 0 - spend ceiling violated',
    demoting: true,
  });

  gates.push({
    id: 'policy-no-secrets',
    satisfied: policySummary.noSecrets,
    detail: policySummary.noSecrets ? 'no secret material detected' : 'secret material detected',
    demoting: true,
  });

  gates.push({
    id: 'evidence-bound',
    satisfied: evidenceBound && evidenceSummary.chainValid && evidenceSummary.entries > 0,
    detail: `${evidenceSummary.entries} evidence entr(ies), chain valid=${evidenceSummary.chainValid}`,
  });

  gates.push({
    id: 'evidence-commit-bound',
    satisfied: evidenceSummary.commitBound,
    detail: evidenceSummary.commitBound
      ? 'evidence is bound to the certified commit'
      : 'evidence is not bound to a commit - cannot attribute it to this release',
  });

  gates.push({
    id: 'health-known',
    satisfied: health.status !== 'UNKNOWN',
    detail:
      health.status === 'UNKNOWN'
        ? `${health.unknownCount} signal(s) UNKNOWN - a check that did not run is not a pass`
        : `health status ${health.status}`,
  });

  gates.push({
    id: 'health-not-unhealthy',
    satisfied: health.status !== 'UNHEALTHY',
    detail: `${health.healthyCount} healthy, ${health.degradedCount} degraded, ${health.unhealthyCount} unhealthy`,
    demoting: true,
  });

  gates.push({
    id: 'promotion-target-exists',
    satisfied: target !== null,
    detail: target ? `may promote ${current} -> ${target}` : `${current} is already the maximum level`,
  });

  return { gates, target };
}

/** Decide PROMOTE / HOLD / DEMOTE from real evidence. */
export function decidePromotion(
  current: AutonomyLevel,
  evidence: PromotionEvidence,
): PromotionResult {
  const { gates, target } = evaluatePromotionGates(current, evidence);

  const demotingFailures = gates.filter((g) => g.demoting && !g.satisfied);
  const blockingFailures = gates.filter((g) => !g.satisfied);
  const reasons = blockingFailures.map((g) => `${g.id}: ${g.detail}`);

  let decision: PromotionResult['decision'];
  let to: AutonomyLevel;

  if (demotingFailures.length > 0) {
    decision = 'DEMOTE';
    to = previousLevel(current) ?? current;
    reasons.unshift(
      `${demotingFailures.length} safety gate(s) failed (${demotingFailures.map((g) => g.id).join(', ')}) - demoting`,
    );
  } else if (target === null) {
    decision = 'HOLD';
    to = current;
    reasons.unshift('already at maximum autonomy level - nothing to promote to');
  } else if (blockingFailures.length > 0) {
    decision = 'HOLD';
    to = current;
    reasons.unshift(`${blockingFailures.length} gate(s) unmet - holding at ${current}`);
  } else {
    decision = 'PROMOTE';
    to = target;
    reasons.push(`all ${gates.length} promotion gates satisfied`);
  }

  return {
    decision,
    from: current,
    to,
    reasons,
    gates: gates.map((g) => ({ id: g.id, satisfied: g.satisfied, detail: g.detail })),
    decidedAt: new Date().toISOString(),
  };
}

/**
 * Minimum evidence required before a level may even be considered.
 * Used to reject promotion requests built from placeholder data.
 */
export function evidenceIsSubstantive(evidence: PromotionEvidence): {
  substantive: boolean;
  problems: string[];
} {
  const problems: string[] = [];

  if (evidence.testSummary.total === 0) problems.push('no tests were run');
  if (evidence.testSummary.suites.length === 0) problems.push('no test suites named');
  if (evidence.policySummary.checksRun === 0) problems.push('no policy checks were run');
  if (evidence.evidenceSummary.entries === 0) problems.push('evidence journal is empty');
  if (evidence.health.signals.length === 0) problems.push('no health signals were collected');

  return { substantive: problems.length === 0, problems };
}
