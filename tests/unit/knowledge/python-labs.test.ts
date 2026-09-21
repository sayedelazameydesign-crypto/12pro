import { describe, expect, it } from 'vitest';
import { spawnSync, type SpawnSyncReturns } from 'child_process';
import path from 'path';

const REPO_ROOT = process.cwd();
const LABS_DIR = path.join(REPO_ROOT, 'examples', 'ml-course');

function python(): string | null {
  for (const candidate of ['python3', 'python']) {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf-8' });
    if (probe.status === 0) return candidate;
  }
  return null;
}

const PYTHON = python();
const describeOrSkip = PYTHON ? describe : describe.skip;

let cachedRun: SpawnSyncReturns<string> | null = null;

/** `run_all.py` executes the 8 labs once (~6s) and every test below reads that one run. */
function runSuite(): SpawnSyncReturns<string> {
  if (!cachedRun) {
    cachedRun = spawnSync(PYTHON!, [path.join(LABS_DIR, 'run_all.py')], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 300_000,
    });
  }
  return cachedRun;
}

function suiteSummary() {
  const run = runSuite();
  const resultLine = run.stdout
    .split('\n')
    .reverse()
    .find((line) => line.startsWith('RESULT '));
  expect(resultLine, run.stdout).toBeDefined();
  return JSON.parse(resultLine!.slice('RESULT '.length));
}

function runLab(script: string) {
  const run = spawnSync(PYTHON!, [path.join(LABS_DIR, script)], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
  });
  expect(run.status, `${script}: ${run.stderr}`).toBe(0);
  const resultLine = run.stdout
    .split('\n')
    .reverse()
    .find((line) => line.startsWith('RESULT '));
  expect(resultLine, `${script} must print a RESULT line`).toBeDefined();
  return JSON.parse(resultLine!.slice('RESULT '.length));
}

describeOrSkip('knowledge/ml-course python labs', () => {
  it(
    'runs every stage lab and reports 8/8 PASS',
    () => {
      const run = runSuite();
      expect(run.status, run.stderr || run.stdout).toBe(0);
      expect(run.stdout).toContain('8/8 stages PASS');

      const summary = suiteSummary();
      expect(summary.suite).toBe('ml-from-zero');
      expect(summary.status).toBe('PASS');
      expect(summary.stages_passed).toBe(8);
      expect(summary.stages_run).toBe(8);
      expect(summary.results).toHaveLength(8);
      expect(summary.results.every((stage: any) => stage.status === 'PASS')).toBe(true);
      expect(summary.results.map((stage: any) => stage.stage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    },
    300_000,
  );

  it('each lab runs standalone, dependency-free, and prints a machine-readable RESULT line', () => {
    for (const script of ['stage1_fundamentals.py', 'stage2_regression.py', 'stage8_agent_loop.py']) {
      const payload = runLab(script);
      expect(payload.status).toBe('PASS');
      expect(typeof payload.stage).toBe('number');
      expect(typeof payload.name).toBe('string');
    }
  }, 180_000);

  it(
    'proves the claim each lab exists to prove',
    () => {
      const byStage = new Map<number, any>(suiteSummary().results.map((payload: any) => [payload.stage, payload]));
      expect(byStage.size).toBe(8);

      // Stage 2: the parameters were learned, not written by hand
      expect(byStage.get(2).rmse_after_egp).toBeLessThan(byStage.get(2).rmse_before_egp / 10);
      expect(byStage.get(2).weights_real_units.area_m2).toBeGreaterThan(0);

      // Stage 3: gradient descent converges, the analytic gradient is right, and an
      // oversized learning rate diverges
      expect(byStage.get(3).gradient_matches_finite_difference).toBe(true);
      expect(byStage.get(3).converged_loss).toBeLessThan(0.005);
      expect(byStage.get(3).learning_rate_comparison.too_large.diverged).toBe(true);
      expect(byStage.get(3).learning_rate_comparison.good.final_loss).toBeLessThan(
        byStage.get(3).learning_rate_comparison.too_small.final_loss,
      );

      // Stage 4: accuracy hides the rare class
      expect(byStage.get(4).rare_class.lazy_accuracy).toBeGreaterThan(0.98);
      expect(byStage.get(4).rare_class.lazy_recall).toBe(0);
      expect(byStage.get(4).rare_class.trained_recall).toBeGreaterThan(0);
      expect(byStage.get(4).balanced_test_metrics.accuracy).toBeGreaterThan(0.9);

      // Stage 5: depth solves what a line cannot
      expect(byStage.get(5).linear_baseline.accuracy).toBeLessThanOrEqual(0.75);
      expect(byStage.get(5).network.accuracy).toBe(1);
      expect(byStage.get(5).network.loss).toBeLessThan(byStage.get(5).linear_baseline.loss);

      // Stage 6: same model, worse data
      expect(byStage.get(6).label_noise.clean_accuracy).toBeGreaterThan(byStage.get(6).label_noise.noisy_accuracy);
      expect(byStage.get(6).slice_evaluation.night.accuracy).toBeLessThan(byStage.get(6).slice_evaluation.day.accuracy);
      expect(byStage.get(6).slice_evaluation.overall.accuracy).toBeGreaterThan(0.85);
      expect(byStage.get(6).leakage.leaked_accuracy).toBeGreaterThan(byStage.get(6).leakage.honest_accuracy);

      // Stage 7: an LLM is the same loop — the cross-entropy must fall
      expect(byStage.get(7).loss_after).toBeLessThan(byStage.get(7).loss_before * 0.6);
      expect(byStage.get(7).probabilities['the bird → sang']).toBeGreaterThan(0.6);

      // Stage 8: an agent verifies, corrects itself and respects policy
      expect(byStage.get(8).corrections).toBeGreaterThanOrEqual(1);
      expect(byStage.get(8).blocked_actions).toBeGreaterThanOrEqual(1);
      expect(byStage.get(8).answer).toBe(byStage.get(8).oracle);
      expect(byStage.get(8).cost).toBe(0);
      expect(byStage.get(8).phases).toContain('verify');
    },
    300_000,
  );
});
