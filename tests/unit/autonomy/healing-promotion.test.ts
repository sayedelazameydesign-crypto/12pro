import { describe, it, expect } from 'vitest';
import {
  selectHealingAction,
  selfHeal,
  HEALING_LADDER,
  decidePromotion,
  evidenceIsSubstantive,
  nextLevel,
  previousLevel,
  createSupervisor,
} from '@agi-system/autonomy';
import type { HealthReport, HealingAttempt, PromotionEvidence } from '@agi-system/autonomy';

function signalLike(name: string, status: HealthReport['status']): HealthReport['signals'][number] {
  return { name, status, detail: `${name}=${status}`, checkedAt: new Date().toISOString() };
}

/** Health report with a populated signal list, so it counts as substantive evidence. */
function health(status: HealthReport['status'], unknownCount = 0): HealthReport {
  return {
    status,
    signals: [signalLike('probe', status)],
    healthyCount: status === 'HEALTHY' ? 1 : 0,
    degradedCount: status === 'DEGRADED' ? 1 : 0,
    unhealthyCount: status === 'UNHEALTHY' ? 1 : 0,
    unknownCount: status === 'UNKNOWN' ? 1 : unknownCount,
  };
}

function goodEvidence(overrides: Partial<PromotionEvidence> = {}): PromotionEvidence {
  return {
    testsPassed: true,
    testSummary: { total: 22, passed: 22, failed: 0, suites: ['unit', 'integration'] },
    policyPassed: true,
    policySummary: { maxSpendZero: true, noSecrets: true, checksRun: 6, checksPassed: 6 },
    evidenceBound: true,
    evidenceSummary: { entries: 4, chainValid: true, commitBound: true },
    health: health('HEALTHY'),
    ...overrides,
  };
}

describe('autonomy / self-healing', () => {
  it('orders the ladder from least to most disruptive and ends in escalation', () => {
    expect(HEALING_LADDER[HEALING_LADDER.length - 1]).toBe('ESCALATE_HUMAN');
    expect(HEALING_LADDER[0]).toBe('RESTART_COMPONENT');
  });

  it('does nothing when the system is healthy', () => {
    const { action } = selectHealingAction({
      health: health('HEALTHY'),
      consecutiveFailures: 0,
      attemptsSoFar: [],
      checkpointAvailable: true,
    });
    expect(action).toBe('NONE');
  });

  it('escalates rather than restarting blind when health is UNKNOWN', () => {
    const { action, reason } = selectHealingAction({
      health: health('UNKNOWN', 1),
      consecutiveFailures: 0,
      attemptsSoFar: [],
      checkpointAvailable: true,
    });
    expect(action).toBe('ESCALATE_HUMAN');
    expect(reason).toMatch(/UNKNOWN/);
  });

  it('tries restart before rollback when merely degraded', () => {
    const { action } = selectHealingAction({
      health: health('DEGRADED'),
      consecutiveFailures: 1,
      attemptsSoFar: [],
      checkpointAvailable: true,
    });
    expect(action).toBe('RESTART_COMPONENT');
  });

  it('walks the ladder as attempts accumulate', () => {
    const ctx: {
      health: HealthReport;
      consecutiveFailures: number;
      attemptsSoFar: HealingAttempt[];
      checkpointAvailable: boolean;
    } = {
      health: health('UNHEALTHY'),
      consecutiveFailures: 3,
      attemptsSoFar: [],
      checkpointAvailable: true,
    };
    expect(selectHealingAction(ctx).action).toBe('ROLLBACK_CHECKPOINT');

    ctx.attemptsSoFar = [{ action: 'ROLLBACK_CHECKPOINT', reason: '', attemptedAt: '', succeeded: false, detail: '' }];
    expect(selectHealingAction(ctx).action).toBe('DEGRADE_AUTONOMY');

    ctx.attemptsSoFar = [
      ...ctx.attemptsSoFar,
      { action: 'DEGRADE_AUTONOMY', reason: '', attemptedAt: '', succeeded: false, detail: '' },
    ];
    expect(selectHealingAction(ctx).action).toBe('ESCALATE_HUMAN');
  });

  it('always terminates, and terminates in escalation when nothing resolves', async () => {
    const result = await selfHeal(
      { health: health('UNHEALTHY'), consecutiveFailures: 5, attemptsSoFar: [], checkpointAvailable: true },
      [], // no handlers registered at all
      4,
    );
    expect(result.resolved).toBe(false);
    expect(result.escalated).toBe(true);
    expect(result.attempts.length).toBeGreaterThan(0);
    expect(result.attempts.length).toBeLessThanOrEqual(4);
  });

  it('stops as soon as a handler resolves the problem', async () => {
    const result = await selfHeal(
      { health: health('UNHEALTHY'), consecutiveFailures: 2, attemptsSoFar: [], checkpointAvailable: true },
      [{ action: 'ROLLBACK_CHECKPOINT', run: () => true }],
      4,
    );
    expect(result.resolved).toBe(true);
    expect(result.escalated).toBe(false);
    expect(result.attempts.every((a) => a.action === 'ROLLBACK_CHECKPOINT')).toBe(true);
  });

  it('treats a throwing handler as a failed attempt, not as success', async () => {
    const result = await selfHeal(
      { health: health('UNHEALTHY'), consecutiveFailures: 2, attemptsSoFar: [], checkpointAvailable: true },
      [
        {
          action: 'ROLLBACK_CHECKPOINT',
          run: () => {
            throw new Error('handler blew up');
          },
        },
      ],
      4,
    );
    const attempt = result.attempts.find((a) => a.action === 'ROLLBACK_CHECKPOINT');
    expect(attempt?.succeeded).toBe(false);
    expect(attempt?.detail).toContain('handler blew up');
    expect(result.resolved).toBe(false);
  });
});

describe('autonomy / promotion', () => {
  it('walks a strictly ordered single-step ladder', () => {
    expect(nextLevel('L0_MANUAL')).toBe('L1_ASSISTED');
    expect(nextLevel('L1_ASSISTED')).toBe('L2_SUPERVISED');
    expect(nextLevel('L2_SUPERVISED')).toBe('L3_AUTONOMOUS');
    expect(nextLevel('L3_AUTONOMOUS')).toBeNull();
    expect(previousLevel('L0_MANUAL')).toBeNull();
    expect(previousLevel('L3_AUTONOMOUS')).toBe('L2_SUPERVISED');
  });

  it('promotes when tests AND policy AND evidence all hold', () => {
    const result = decidePromotion('L0_MANUAL', goodEvidence());
    expect(result.decision).toBe('PROMOTE');
    expect(result.to).toBe('L1_ASSISTED');
    expect(result.gates.every((g) => g.satisfied)).toBe(true);
  });

  it('never jumps two levels', () => {
    const result = decidePromotion('L0_MANUAL', goodEvidence());
    expect(result.to).not.toBe('L2_SUPERVISED');
    expect(result.to).not.toBe('L3_AUTONOMOUS');
  });

  it('holds when a test failed', () => {
    const result = decidePromotion(
      'L1_ASSISTED',
      goodEvidence({
        testsPassed: false,
        testSummary: { total: 22, passed: 20, failed: 2, suites: ['unit'] },
      }),
    );
    expect(result.decision).toBe('HOLD');
    expect(result.to).toBe('L1_ASSISTED');
    expect(result.reasons.join(' ')).toMatch(/tests-passed/);
  });

  it('holds when the suite is empty - zero tests is not evidence', () => {
    const result = decidePromotion(
      'L1_ASSISTED',
      goodEvidence({ testSummary: { total: 0, passed: 0, failed: 0, suites: [] } }),
    );
    expect(result.decision).toBe('HOLD');
    expect(result.reasons.join(' ')).toMatch(/tests-not-empty|no tests ran/);
  });

  it('DEMOTES when the zero-spend ceiling is violated', () => {
    const result = decidePromotion(
      'L2_SUPERVISED',
      goodEvidence({ policySummary: { maxSpendZero: false, noSecrets: true, checksRun: 6, checksPassed: 5 }, policyPassed: false }),
    );
    expect(result.decision).toBe('DEMOTE');
    expect(result.to).toBe('L1_ASSISTED');
  });

  it('DEMOTES when secret material is present', () => {
    const result = decidePromotion(
      'L2_SUPERVISED',
      goodEvidence({ policySummary: { maxSpendZero: true, noSecrets: false, checksRun: 6, checksPassed: 5 }, policyPassed: false }),
    );
    expect(result.decision).toBe('DEMOTE');
  });

  it('DEMOTES when health is UNHEALTHY', () => {
    const result = decidePromotion('L2_SUPERVISED', goodEvidence({ health: health('UNHEALTHY') }));
    expect(result.decision).toBe('DEMOTE');
    expect(result.to).toBe('L1_ASSISTED');
  });

  it('holds when health is UNKNOWN - a check that did not run is not a pass', () => {
    const result = decidePromotion('L1_ASSISTED', goodEvidence({ health: health('UNKNOWN', 2) }));
    expect(result.decision).toBe('HOLD');
    expect(result.reasons.join(' ')).toMatch(/health-known|UNKNOWN/);
  });

  it('holds when evidence is not commit-bound', () => {
    const result = decidePromotion(
      'L1_ASSISTED',
      goodEvidence({ evidenceSummary: { entries: 4, chainValid: true, commitBound: false } }),
    );
    expect(result.decision).toBe('HOLD');
    expect(result.reasons.join(' ')).toMatch(/evidence-commit-bound/);
  });

  it('holds at the top of the ladder instead of inventing a higher level', () => {
    const result = decidePromotion('L3_AUTONOMOUS', goodEvidence());
    expect(result.decision).toBe('HOLD');
    expect(result.to).toBe('L3_AUTONOMOUS');
  });

  it('rejects placeholder evidence as non-substantive', () => {
    const placeholder = goodEvidence({
      testSummary: { total: 0, passed: 0, failed: 0, suites: [] },
      policySummary: { maxSpendZero: true, noSecrets: true, checksRun: 0, checksPassed: 0 },
      evidenceSummary: { entries: 0, chainValid: true, commitBound: false },
      health: { status: 'UNKNOWN', signals: [], healthyCount: 0, degradedCount: 0, unhealthyCount: 0, unknownCount: 0 },
    });
    const result = evidenceIsSubstantive(placeholder);
    expect(result.substantive).toBe(false);
    expect(result.problems.length).toBeGreaterThanOrEqual(3);
    expect(evidenceIsSubstantive(goodEvidence()).substantive).toBe(true);
  });

  it('reports every gate it evaluated so a HOLD is explainable', () => {
    const result = decidePromotion('L1_ASSISTED', goodEvidence({ testsPassed: false }));
    expect(result.gates.length).toBeGreaterThanOrEqual(9);
    expect(result.gates.some((g) => g.id === 'tests-passed' && !g.satisfied)).toBe(true);
    expect(result.gates.some((g) => g.id === 'policy-max-spend-zero' && g.satisfied)).toBe(true);
  });
});

describe('autonomy / supervisor', () => {
  it('starts at the configured level and never above it', () => {
    expect(createSupervisor({ config: { level: 'L0_MANUAL' } }).level).toBe('L0_MANUAL');
    expect(createSupervisor().level).toBe('L0_MANUAL');
  });

  it('rejects an invalid configured level', () => {
    expect(() => createSupervisor({ config: { level: 'L9_GODMODE' as never } })).toThrow(/invalid autonomy level/);
  });

  it('checkpoints state on every tick and keeps an audit log', async () => {
    const supervisor = createSupervisor({
      probes: [{ name: 'ok', check: () => ({ name: 'ok', status: 'HEALTHY', detail: 'ok', checkedAt: '' }) }],
    });
    const result = await supervisor.tick({ state: { step: 1 } });

    expect(result.health.status).toBe('HEALTHY');
    expect(result.checkpoint.label).toBe('pre-action');
    expect(supervisor.store().list().length).toBe(1);
    expect(supervisor.events.length).toBeGreaterThan(0);
    expect(supervisor.events.map((e) => e.type)).toContain('HEALTH_CHECK');
    expect(supervisor.events.map((e) => e.type)).toContain('CHECKPOINT');
  });

  it('does not promote without evidence, even when healthy', async () => {
    const supervisor = createSupervisor({
      probes: [{ name: 'ok', check: () => ({ name: 'ok', status: 'HEALTHY', detail: 'ok', checkedAt: '' }) }],
    });
    const result = await supervisor.tick({ state: { step: 1 } });
    expect(result.promotion).toBeNull();
    expect(supervisor.level).toBe('L0_MANUAL');
  });

  it('promotes only when substantive evidence is supplied', async () => {
    const supervisor = createSupervisor({
      probes: [{ name: 'ok', check: () => ({ name: 'ok', status: 'HEALTHY', detail: 'ok', checkedAt: '' }) }],
    });
    const result = await supervisor.tick({ state: { step: 1 }, promotionEvidence: goodEvidence() });
    expect(result.promotion?.decision).toBe('PROMOTE');
    expect(supervisor.level).toBe('L1_ASSISTED');
  });

  it('refuses to promote on placeholder evidence and says why', async () => {
    const supervisor = createSupervisor();
    const placeholder = goodEvidence({
      testSummary: { total: 0, passed: 0, failed: 0, suites: [] },
      policySummary: { maxSpendZero: true, noSecrets: true, checksRun: 0, checksPassed: 0 },
      evidenceSummary: { entries: 0, chainValid: true, commitBound: false },
    });
    const result = await supervisor.tick({ state: {}, promotionEvidence: placeholder });
    expect(result.promotion?.decision).toBe('HOLD');
    expect(result.promotion?.reasons.join(' ')).toMatch(/not substantive|placeholder/);
    expect(supervisor.level).toBe('L0_MANUAL');
  });

  it('degrades to L0 after reaching the consecutive-failure ceiling', async () => {
    const supervisor = createSupervisor({
      config: { level: 'L2_SUPERVISED', maxConsecutiveFailures: 2 },
      probes: [{ name: 'ok', check: () => ({ name: 'ok', status: 'HEALTHY', detail: 'ok', checkedAt: '' }) }],
    });
    expect(supervisor.level).toBe('L2_SUPERVISED');

    await supervisor.tick({ state: { s: 1 }, recordFailure: true });
    await supervisor.tick({ state: { s: 2 }, recordFailure: true });

    expect(supervisor.level).toBe('L0_MANUAL');
    expect(supervisor.events.map((e) => e.type)).toContain('DEMOTION');
  });

  it('escalates and drops to L0 when health is UNKNOWN and unhealable', async () => {
    const supervisor = createSupervisor({
      config: { level: 'L3_AUTONOMOUS' },
      probes: [
        {
          name: 'mystery',
          check: () => ({ name: 'mystery', status: 'UNKNOWN' as const, detail: 'could not run', checkedAt: '' }),
        },
      ],
    });
    const result = await supervisor.tick({ state: {} });
    expect(result.healing.escalated).toBe(true);
    expect(supervisor.level).toBe('L0_MANUAL');
  });
});
