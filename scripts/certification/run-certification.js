#!/usr/bin/env node
/**
 * Certification orchestrator.
 *
 * This is the ONLY thing that is allowed to produce a certification artifact. It
 * exists to close the gap that made the previous certification unverifiable:
 *
 *   BEFORE  gate files were written by hand with template numbers ("60/60") and a
 *           commit SHA copied in from an earlier state. Nothing compared that SHA
 *           with the commit actually being certified, so the artifacts drifted and
 *           still reported PASS.
 *
 *   NOW     every gate is derived from the exit status and parsed output of a real
 *           command run against this checkout, and bound to a single commit that is
 *           resolved once at the start and asserted again at the end.
 *
 * Rules it enforces on itself:
 *   - a suite that did not run is NOT_CERTIFIED, never PASS
 *   - a placeholder suite is PARTIAL, never PASS
 *   - counts come from parsed reporter output, never from a template
 *   - the commit must be a 40-hex SHA when binding is required
 *   - any blocking gate that is not PASS fails the process
 *
 * Usage:
 *   node scripts/certification/run-certification.js --commit=$GITHUB_SHA
 *   node scripts/certification/run-certification.js --skip=build,e2e
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectE2EPlaceholders,
  inspectDocumentation,
  inspectReleaseReadiness,
  inspectWorkflowHardening,
} from './lib/inspect.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

// --------------------------------------------------------------------------- args

function argValue(flag, fallback = null) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : fallback;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}

const IN_CI = process.env.CI === 'true';
const REQUESTED_COMMIT = argValue('--commit');
const REQUIRE_BINDING = hasFlag('--require-binding') || IN_CI;
const SKIP = new Set((argValue('--skip', '') || '').split(',').map((s) => s.trim()).filter(Boolean));
const OUT = resolve(argValue('--out', join(ROOT, 'certification')));
const RAW_DIR = join(OUT, 'reports', 'raw');
const QUICK = hasFlag('--quick');

function resolveCommit() {
  if (REQUESTED_COMMIT) return { commit: REQUESTED_COMMIT.trim(), source: 'argument' };
  if (process.env.GITHUB_SHA) return { commit: process.env.GITHUB_SHA.trim(), source: 'GITHUB_SHA' };
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf-8' });
  if (result.status === 0 && result.stdout) return { commit: result.stdout.trim(), source: 'git-rev-parse' };
  return { commit: null, source: 'unbound' };
}

const { commit: COMMIT, source: COMMIT_SOURCE } = resolveCommit();
const IS_SHA = typeof COMMIT === 'string' && /^[0-9a-f]{40}$/.test(COMMIT);

if (REQUIRE_BINDING && !IS_SHA) {
  console.error(`[certify] FATAL: commit binding is required but the resolved commit is not a 40-hex SHA (got ${String(COMMIT)} from ${COMMIT_SOURCE}).`);
  console.error('[certify] Refusing to emit a certification that cannot be attributed to a commit.');
  process.exit(2);
}

console.log(`[certify] repository   : ${ROOT}`);
console.log(`[certify] commit       : ${COMMIT ?? '(unbound)'} [source: ${COMMIT_SOURCE}]`);
console.log(`[certify] binding      : ${REQUIRE_BINDING ? 'REQUIRED' : 'optional'}`);
console.log(`[certify] skip         : ${SKIP.size ? [...SKIP].join(', ') : '(none)'}`);

// ------------------------------------------------------------------- suite running

/** Run a command, capturing exit code, duration and output. Never swallows failure. */
function runStep(id, command, args, options = {}) {
  if (SKIP.has(id)) {
    console.log(`[certify] SKIP  ${id} (requested)`);
    return { id, ran: false, skipped: true, exitCode: null, durationMs: 0, stdout: '', stderr: '' };
  }
  const started = Date.now();
  console.log(`[certify] RUN   ${id}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(options.env ?? {}), GITHUB_SHA: COMMIT ?? process.env.GITHUB_SHA ?? '' },
    shell: false,
  });
  const durationMs = Date.now() - started;
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const exitCode = result.status;
  console.log(`[certify]       ${id} exit=${exitCode} in ${durationMs}ms`);
  if (exitCode !== 0 && !options.tolerateFailure) {
    const tail = (stderr || stdout).split('\n').filter(Boolean).slice(-12).join('\n');
    if (tail) console.log(`[certify]       output tail:\n${tail}`);
  }
  return { id, ran: true, skipped: false, exitCode, durationMs, stdout, stderr, error: result.error?.message ?? null };
}

/** Run a vitest suite with the JSON reporter and parse REAL counts from it. */
function runVitestSuite(id, target) {
  const outFile = join(RAW_DIR, `${id}.vitest.json`);
  mkdirSync(dirname(outFile), { recursive: true });
  if (existsSync(outFile)) rmSync(outFile);

  const step = runStep(id, 'npx', ['vitest', 'run', target, '--reporter=json', `--outputFile=${outFile}`], {
    tolerateFailure: true,
  });

  if (!step.ran) return { ...step, measured: false, total: null, passed: null, failed: null };

  if (!existsSync(outFile)) {
    return {
      ...step,
      measured: false,
      total: null,
      passed: null,
      failed: null,
      parseError: `vitest produced no JSON report at ${outFile}`,
    };
  }

  try {
    const report = JSON.parse(readFileSync(outFile, 'utf-8'));
    return {
      ...step,
      measured: true,
      total: report.numTotalTests ?? 0,
      passed: report.numPassedTests ?? 0,
      failed: report.numFailedTests ?? 0,
      pending: report.numPendingTests ?? 0,
      suites: report.numTotalTestSuites ?? 0,
      reporterSuccess: report.success === true,
      files: (report.testResults ?? []).map((t) => String(t.name ?? '').replace(`${ROOT}/`, '')),
      reportPath: outFile,
    };
  } catch (err) {
    return { ...step, measured: false, total: null, passed: null, failed: null, parseError: `unparsable vitest report: ${err.message}` };
  }
}

// ------------------------------------------------------------------- gate assembly

/**
 * Gate definitions.
 *
 * `blocking: true` means CI fails unless the gate is PASS. G5 (E2E) is deliberately
 * non-blocking because the suite is a placeholder; it reports PARTIAL and says so,
 * rather than claiming a pass it cannot support.
 */
const GATE_DEFS = [
  { gate: 'G0', name: 'Build & Lint & Typecheck', required: true, blocking: true },
  { gate: 'G1', name: 'Unit Tests', required: true, blocking: true },
  { gate: 'G2', name: 'Integration Tests', required: true, blocking: true },
  { gate: 'G3', name: 'Security Tests', required: true, blocking: true },
  { gate: 'G4', name: 'Contract Tests', required: true, blocking: true },
  { gate: 'G5', name: 'E2E Tests', required: false, blocking: false },
  { gate: 'G6', name: 'Stress Tests', required: true, blocking: true },
  { gate: 'G7', name: 'Chaos Tests', required: true, blocking: true },
  { gate: 'G8', name: 'Benchmarks', required: true, blocking: false },
  { gate: 'G9', name: 'Acceptance / Long-Horizon', required: true, blocking: false },
  { gate: 'G10', name: 'Governance Policy', required: true, blocking: true },
  { gate: 'G11', name: 'Documentation', required: false, blocking: false },
  { gate: 'G12', name: 'Release Readiness', required: false, blocking: false },
  { gate: 'G13', name: 'Long-Horizon Evaluation', required: false, blocking: false },
  { gate: 'G14', name: 'Safety Evaluation - 100% PASS required', required: true, blocking: true },
  { gate: 'G15', name: 'Atomic Core Kernel - Invariants Gate', required: true, blocking: true },
];

function gateArtifact(def, body) {
  return {
    gate: def.gate,
    name: def.name,
    required: def.required,
    blocking: def.blocking,
    /** Bound to the single commit resolved at the start of this run. */
    commit: COMMIT,
    commitSource: COMMIT_SOURCE,
    timestamp: new Date().toISOString(),
    generator: 'scripts/certification/run-certification.js',
    ...body,
  };
}

function suiteGate(def, suite, notes = []) {
  if (!suite.ran) {
    return gateArtifact(def, {
      status: 'NOT_CERTIFIED',
      tests: null,
      passed: null,
      failed: null,
      reason: suite.skipped ? 'suite was skipped for this run' : 'suite did not run',
      notes,
    });
  }
  if (!suite.measured) {
    return gateArtifact(def, {
      status: 'NOT_CERTIFIED',
      tests: null,
      passed: null,
      failed: null,
      reason: suite.parseError ?? `command exited ${suite.exitCode} without producing a parsable report`,
      exitCode: suite.exitCode,
      durationMs: suite.durationMs,
      notes,
    });
  }
  const status = suite.failed === 0 && suite.total > 0 && suite.exitCode === 0 ? 'PASS' : suite.total === 0 ? 'NOT_CERTIFIED' : 'FAIL';
  return gateArtifact(def, {
    status,
    tests: suite.total,
    passed: suite.passed,
    failed: suite.failed,
    pending: suite.pending ?? 0,
    suites: suite.suites ?? 0,
    exitCode: suite.exitCode,
    durationMs: suite.durationMs,
    evidenceSource: suite.reportPath ? suite.reportPath.replace(`${ROOT}/`, '') : null,
    files: suite.files ?? [],
    reason:
      status === 'PASS'
        ? `${suite.passed}/${suite.total} real test(s) passed, exit 0`
        : status === 'FAIL'
          ? `${suite.failed} of ${suite.total} test(s) failed`
          : 'the suite reported zero tests - an empty suite is not evidence',
    notes,
  });
}

function commandGate(def, steps, notes = []) {
  const ran = steps.filter((s) => s.ran);
  if (ran.length === 0) {
    return gateArtifact(def, { status: 'NOT_CERTIFIED', reason: 'no command ran', tests: null, passed: null, failed: null, notes });
  }
  const failedSteps = ran.filter((s) => s.exitCode !== 0);
  const status = failedSteps.length === 0 ? 'PASS' : 'FAIL';
  return gateArtifact(def, {
    status,
    tests: ran.length,
    passed: ran.length - failedSteps.length,
    failed: failedSteps.length,
    durationMs: ran.reduce((a, s) => a + s.durationMs, 0),
    steps: ran.map((s) => ({ id: s.id, exitCode: s.exitCode, durationMs: s.durationMs })),
    reason:
      status === 'PASS'
        ? `all ${ran.length} command(s) exited 0`
        : `${failedSteps.length} command(s) failed: ${failedSteps.map((s) => `${s.id}(exit ${s.exitCode})`).join(', ')}`,
    notes,
  });
}

// ------------------------------------------------------------------------- run all

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(join(OUT, 'gates'), { recursive: true });
mkdirSync(join(OUT, 'reports'), { recursive: true });
mkdirSync(join(OUT, 'identity'), { recursive: true });

const results = {};

// --- G0: build, lint, typecheck -------------------------------------------
const lint = runStep('lint', 'npm', ['run', 'lint']);
const typecheck = runStep('typecheck', 'npm', ['run', 'typecheck']);
const build = QUICK ? { id: 'build', ran: false, skipped: true, exitCode: null, durationMs: 0 } : runStep('build', 'npm', ['run', 'build'], { tolerateFailure: true });
results.G0 = commandGate(GATE_DEFS[0], [lint, typecheck, build]);

// --- G1..G4, G6, G7, G9: real vitest suites -------------------------------
const unit = runVitestSuite('unit', 'tests/unit');
results.G1 = suiteGate(GATE_DEFS[1], unit);

const integration = runVitestSuite('integration', 'tests/integration');
results.G2 = suiteGate(GATE_DEFS[2], integration);

const security = runVitestSuite('security', 'tests/security');
results.G3 = suiteGate(GATE_DEFS[3], security);

const contract = runVitestSuite('contract', 'tests/contract');
results.G4 = suiteGate(GATE_DEFS[4], contract);

// --- G5: E2E - measured, and honestly PARTIAL when it is a placeholder -----
{
  const e2e = detectE2EPlaceholders();
  const def = GATE_DEFS[5];
  if (!e2e.dirExists || e2e.files.length === 0) {
    results.G5 = gateArtifact(def, {
      status: 'NOT_CERTIFIED',
      tests: null,
      passed: null,
      failed: null,
      reason: 'no tests/e2e suite exists',
    });
  } else if (e2e.placeholders.length > 0 && e2e.real.length === 0) {
    results.G5 = gateArtifact(def, {
      status: 'PARTIAL',
      tests: e2e.files.length,
      passed: null,
      failed: null,
      reason:
        `All ${e2e.files.length} E2E file(s) are placeholders whose only assertion is a tautology. ` +
        'This is reported as PARTIAL and never as PASS: no browser-level behaviour has been exercised.',
      placeholders: e2e.placeholders,
      realFiles: e2e.real,
      requiredForFull: [
        'a real API server started for the test run',
        'playwright browsers installed in CI',
        'assertions against actual responses rather than expect(true).toBeTruthy()',
      ],
    });
  } else {
    const suite = runVitestSuite('e2e', 'tests/e2e');
    results.G5 = suiteGate(def, suite, [
      e2e.placeholders.length > 0
        ? `${e2e.placeholders.length} placeholder file(s) present: ${e2e.placeholders.map((p) => p.path).join(', ')}`
        : 'no placeholder files detected',
    ]);
    if (e2e.placeholders.length > 0) results.G5.status = 'PARTIAL';
  }
}

const stress = runVitestSuite('stress', 'tests/stress');
results.G6 = suiteGate(GATE_DEFS[6], stress);

const chaos = runVitestSuite('chaos', 'tests/chaos');
results.G7 = suiteGate(GATE_DEFS[7], chaos);

// --- G8: benchmarks --------------------------------------------------------
{
  const def = GATE_DEFS[8];
  const names = ['latency', 'memory', 'planning', 'tool-use', 'long-horizon'];
  const steps = names.map((n) => runStep(`benchmark-${n}`, 'node', [`benchmarks/${n}/run.js`, `--output=certification/benchmarks/${n}.json`], { tolerateFailure: true }));
  runStep('benchmark-aggregate', 'node', ['scripts/benchmark/aggregate.js'], { tolerateFailure: true });

  const statuses = [];
  for (const n of names) {
    const file = join(OUT, 'benchmarks', `${n}.json`);
    if (!existsSync(file)) {
      statuses.push({ benchmark: n, status: 'NOT_MEASURED', reason: 'no artifact produced' });
      continue;
    }
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'));
      statuses.push({ benchmark: n, status: data.status ?? 'UNKNOWN', reason: data.reason ?? null, violations: data.violations ?? [] });
    } catch (err) {
      statuses.push({ benchmark: n, status: 'NOT_MEASURED', reason: `unparsable: ${err.message}` });
    }
  }

  const failing = statuses.filter((s) => s.status === 'FAIL');
  const notMeasured = statuses.filter((s) => s.status === 'NOT_MEASURED');
  const passing = statuses.filter((s) => s.status === 'PASS');

  let status;
  if (failing.length > 0) status = 'FAIL';
  else if (notMeasured.length > 0) status = 'PARTIAL';
  else if (passing.length === statuses.length && passing.length > 0) status = 'PASS';
  else status = 'NOT_CERTIFIED';

  results.G8 = gateArtifact(def, {
    status,
    tests: statuses.length,
    passed: passing.length,
    failed: failing.length,
    partial: notMeasured.length,
    benchmarks: statuses,
    reason:
      status === 'PASS'
        ? `all ${passing.length} benchmark(s) measured and evaluated against their thresholds`
        : status === 'PARTIAL'
          ? `${notMeasured.length} benchmark(s) are NOT_MEASURED (${notMeasured.map((s) => s.benchmark).join(', ')}); ` +
            `${passing.length} measured and passed. Reported as PARTIAL, never as PASS.`
          : status === 'FAIL'
            ? `${failing.length} benchmark(s) exceeded their thresholds: ${failing.map((s) => `${s.benchmark}(${(s.violations ?? []).join('; ')})`).join(', ')}`
            : 'no benchmark produced a usable status',
  });
}

// --- G9: acceptance --------------------------------------------------------
const acceptance = runVitestSuite('acceptance', 'tests/acceptance');
results.G9 = suiteGate(GATE_DEFS[9], acceptance);

// --- G10: governance policy ------------------------------------------------
{
  const policy = runStep('policy-check', 'node', ['scripts/supply-chain/policy-check.js', '--strict'], { tolerateFailure: true });
  const workflowProtection = runStep('workflow-protection-check', 'node', ['scripts/supply-chain/workflow-protection-check.js', '--strict'], { tolerateFailure: true });
  // License and provenance belong to the same governance claim. Both used to print
  // "(simulated) - PASS" without inspecting anything; they now read the installed
  // dependency tree and the attestation records respectively, so their exit codes are
  // evidence rather than decoration.
  const licenseCheck = runStep('license-check', 'node', ['scripts/supply-chain/license-check.js'], { tolerateFailure: true });
  // --scope=release, deliberately.
  //
  // The attestation record is written later in this same run (see emitArtifacts), so at
  // this point it does not exist yet and demanding it would fail for an ordering reason
  // rather than a substantive one - the same trap G16's evidence-bound check fell into.
  // Attestation binding is asserted where the record actually exists: by assertBindings()
  // at the end of this run, by scripts/attestation/verify.js, and by the independent
  // verify-remote-binding job in certification.yml.
  const provenance = runStep(
    'provenance-check',
    'node',
    ['scripts/supply-chain/verify-provenance.js', '--scope=release', ...(COMMIT ? [`--commit=${COMMIT}`] : [])],
    { tolerateFailure: true },
  );
  const hardening = inspectWorkflowHardening();
  const notes = [];
  if (hardening.offenders.length > 0) {
    notes.push(
      `${hardening.offenders.length} workflow(s) can still swallow a failure: ` +
        hardening.offenders.map((o) => `${o.file} [${o.problems.join(', ')}]`).join('; '),
    );
  }
  const gate = commandGate(GATE_DEFS[10], [policy, workflowProtection, licenseCheck, provenance], notes);
  // A workflow that hides failures cannot be certified as governed.
  if (hardening.offenders.length > 0) {
    gate.status = 'FAIL';
    gate.reason = `${gate.reason}; ${hardening.offenders.length} workflow(s) hide failures, which defeats governance`;
  }
  gate.workflowHardening = hardening;
  results.G10 = gate;
}

// --- secret scan evidence ---------------------------------------------------
{
  // Not a gate of its own: G16's `no-secret-material` check is the gate, and it scans
  // the same leaves with the same allow-list. This step exists so the standalone report
  // is produced, bound to the same commit, and available as evidence next to the gate
  // rather than only inside it.
  runStep(
    'secret-scan',
    'node',
    ['scripts/security/secret-scan.js', ...(COMMIT ? [`--commit=${COMMIT}`] : [])],
    { tolerateFailure: true },
  );
}

// --- G11: documentation ----------------------------------------------------
{
  const docs = inspectDocumentation();
  const def = GATE_DEFS[11];
  results.G11 = gateArtifact(def, {
    status: docs.missing.length === 0 ? 'PASS' : 'FAIL',
    tests: docs.required.length,
    passed: docs.present,
    failed: docs.missing.length,
    documentation: docs,
    reason: docs.missing.length === 0 ? `all ${docs.required.length} required document(s) present; ${docs.docFiles} markdown file(s) under docs/` : `missing: ${docs.missing.join(', ')}`,
  });
}

// --- G12: release readiness ------------------------------------------------
{
  const release = inspectReleaseReadiness();
  const def = GATE_DEFS[12];
  const failed = release.checks.filter((c) => !c.ok);
  results.G12 = gateArtifact(def, {
    status: failed.length === 0 ? 'PASS' : 'PARTIAL',
    tests: release.total,
    passed: release.ok,
    failed: failed.length,
    checks: release.checks,
    reason: failed.length === 0 ? `all ${release.total} release precondition(s) hold` : `unmet: ${failed.map((c) => c.id).join(', ')}`,
  });
}

// --- G13/G14: evaluations --------------------------------------------------
const evalSafety = runVitestSuite('eval-safety', 'evaluations/safety');
const evalLongHorizon = runVitestSuite('eval-long-horizon', 'evaluations/long-horizon');
const evalCapabilities = runVitestSuite('eval-capabilities', 'evaluations/capabilities');
const evalAll = runVitestSuite('eval-all', 'evaluations');

results.G13 = suiteGate(GATE_DEFS[13], evalLongHorizon);

{
  // G14 requires 100% pass on safety. Anything less is FAIL, never PARTIAL.
  const def = GATE_DEFS[14];
  const gate = suiteGate(def, evalSafety);
  if (gate.status === 'PASS' && evalSafety.failed !== 0) gate.status = 'FAIL';
  if (gate.status === 'PASS') {
    gate.score = evalSafety.total > 0 ? evalSafety.passed / evalSafety.total : 0;
    if (gate.score !== 1) {
      gate.status = 'FAIL';
      gate.reason = `safety gate requires 100% pass, got ${(gate.score * 100).toFixed(1)}%`;
    }
  }
  results.G14 = gate;
}

// --- G15: kernel invariants ------------------------------------------------
{
  const def = GATE_DEFS[15];
  const kernel = runVitestSuite('kernel-invariants', 'tests/unit/kernel');
  const gate = suiteGate(def, kernel);
  // The gate claims specific invariants; verify the source really declares them.
  const invariantsPath = join(ROOT, 'packages/kernel/src/invariants/invariants.ts');
  const declared = existsSync(invariantsPath) ? readFileSync(invariantsPath, 'utf-8') : '';
  const invariantNames = [
    'MAX_SPEND_ZERO',
    'completedTaskCannotExecuteAgain',
    'everyExecutionHasAnIdentity',
    'everyStateTransitionProducesAnEvent',
    'deniedActionCannotReachExecutor',
    'noSecretLeak',
    'stateVersionMonotonic',
    'eventVersionSequential',
    'terminalStateNoOutgoing',
  ];
  const missingInvariants = invariantNames.filter((n) => !declared.includes(n));
  gate.invariants = invariantNames.length - missingInvariants;
  gate.invariantNames = invariantNames;
  if (missingInvariants.length > 0) {
    gate.status = 'FAIL';
    gate.reason = `${gate.reason}; invariants not found in source: ${missingInvariants.join(', ')}`;
  }
  results.G15 = gate;
}

// --------------------------------------------------------------- emit artifacts

/**
 * Write every artifact, bound to the one resolved commit.
 *
 * This deliberately runs TWICE:
 *
 *   phase 1 - after the evidence suites, BEFORE G16. G16 has an `evidence-bound`
 *             check that reads the gate and report artifacts from disk. If they are
 *             written afterwards, that check judges the PREVIOUS run's files and
 *             reports a stale commit, which is exactly the failure mode this whole
 *             pipeline exists to eliminate.
 *   phase 2 - after G16, so the manifest, the attestation and the summary include
 *             the genetic identity gate.
 *
 * Writing is idempotent: the same inputs produce the same bytes. The timestamp is
 * the only field that moves, and it is not part of any hash.
 */
function emitArtifacts(phase) {
  // --------------------------------------------------------------- write artifacts

  const gateOrder = [...GATE_DEFS.map((d) => d.gate), 'G16'];
  for (const name of gateOrder) {
    const artifact = results[name];
    if (!artifact) continue;
    const file = join(OUT, 'gates', `${name}.json`);
    writeFileSync(file, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
  }
  console.log(`[certify] wrote ${gateOrder.filter((g) => results[g]).length} gate artifact(s) to certification/gates/`);

  // --- reports ---------------------------------------------------------------
  function reportFromSuite(name, suite, extra = {}) {
    const measured = suite.measured === true;
    return {
      report: name,
      status: !suite.ran ? 'NOT_CERTIFIED' : !measured ? 'NOT_CERTIFIED' : suite.failed === 0 && suite.total > 0 ? 'PASS' : 'FAIL',
      commit: COMMIT,
      commitSource: COMMIT_SOURCE,
      timestamp: new Date().toISOString(),
      generator: 'scripts/certification/run-certification.js',
      summary: {
        total: measured ? suite.total : null,
        passed: measured ? suite.passed : null,
        failed: measured ? suite.failed : null,
        skipped: measured ? (suite.pending ?? 0) : null,
      },
      evidenceSource: suite.reportPath ? suite.reportPath.replace(`${ROOT}/`, '') : null,
      reason: measured ? `${suite.passed}/${suite.total} real test(s), exit ${suite.exitCode}` : (suite.parseError ?? 'suite did not produce a parsable report'),
      ...extra,
    };
  }

  const reportMap = [
    ['unit', unit],
    ['integration', integration],
    ['security', security],
    ['contract', contract],
    ['acceptance', acceptance],
  ];
  for (const [name, suite] of reportMap) {
    writeFileSync(join(OUT, 'reports', `${name}.json`), `${JSON.stringify(reportFromSuite(name, suite), null, 2)}\n`, 'utf-8');
  }

  // E2E report is PARTIAL, explicitly.
  writeFileSync(
    join(OUT, 'reports', 'e2e.json'),
    `${JSON.stringify(results.G5, null, 2)}\n`,
    'utf-8',
  );

  // Evaluation reports.
  mkdirSync(join(OUT, 'reports', 'evaluations'), { recursive: true });
  writeFileSync(
    join(OUT, 'reports', 'evaluations', 'safety.json'),
    `${JSON.stringify(reportFromSuite('safety', evalSafety), null, 2)}\n`,
    'utf-8',
  );
  writeFileSync(
    join(OUT, 'reports', 'evaluations', 'capabilities.json'),
    `${JSON.stringify(reportFromSuite('capabilities', evalCapabilities), null, 2)}\n`,
    'utf-8',
  );
  writeFileSync(
    join(OUT, 'reports', 'evaluations', 'long-horizon.json'),
    `${JSON.stringify(reportFromSuite('long-horizon', evalLongHorizon), null, 2)}\n`,
    'utf-8',
  );
  writeFileSync(
    join(OUT, 'reports', 'evaluations', 'latest.json'),
    `${JSON.stringify(reportFromSuite('all-evaluations', evalAll), null, 2)}\n`,
    'utf-8',
  );

  // --- manifest --------------------------------------------------------------
  const gatesSummary = {};
  for (const name of gateOrder) {
    const artifact = results[name];
    if (!artifact) continue;
    gatesSummary[name] = {
      status: artifact.status,
      tests: artifact.tests ?? null,
      passed: artifact.passed ?? null,
      failed: artifact.failed ?? null,
      required: artifact.required ?? false,
      blocking: artifact.blocking ?? false,
      commit: artifact.commit ?? null,
    };
  }

  const identityArtifact = existsSync(join(OUT, 'identity', 'genetic-manifest.json'))
    ? JSON.parse(readFileSync(join(OUT, 'identity', 'genetic-manifest.json'), 'utf-8'))
    : null;

  const manifest = {
    version: '0.1.0',
    schema: 'certification-manifest/2',
    /** The single commit this whole manifest describes. */
    commit: COMMIT,
    commitSource: COMMIT_SOURCE,
    timestamp: new Date().toISOString(),
    generator: 'scripts/certification/run-certification.js',
    ci: IN_CI,
    identity: identityArtifact
      ? {
          fingerprint: identityArtifact.manifest.fingerprint,
          identityId: identityArtifact.manifest.identityId,
          manifestHash: identityArtifact.manifest.manifestHash,
          merkleRoot: identityArtifact.manifest.files.merkleRoot,
          leafCount: identityArtifact.manifest.files.leafCount,
          /** Recorded as metadata. Not an input to the fingerprint. */
          boundCommit: identityArtifact.binding.commit,
          bindingMatchesManifest: identityArtifact.binding.commit === COMMIT,
        }
      : null,
    gates: gatesSummary,
    counts: {
      gates: Object.keys(gatesSummary).length,
      pass: Object.values(gatesSummary).filter((g) => g.status === 'PASS').length,
      fail: Object.values(gatesSummary).filter((g) => g.status === 'FAIL').length,
      partial: Object.values(gatesSummary).filter((g) => g.status === 'PARTIAL').length,
      notCertified: Object.values(gatesSummary).filter((g) => g.status === 'NOT_CERTIFIED').length,
    },
    release: {
      tag: `v0.1.0`,
      artifacts: ['certification manifest', 'genetic identity record', 'gate artifacts', 'raw vitest reports'],
    },
  };

  writeFileSync(join(OUT, 'manifests', 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  mkdirSync(join(OUT, 'manifests'), { recursive: true });
  writeFileSync(join(OUT, 'manifests', 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  // --- attestation bound to the same commit ----------------------------------
  const attestation = {
    version: '0.1.0',
    schema: 'attestation/2',
    commit: COMMIT,
    commitSource: COMMIT_SOURCE,
    timestamp: new Date().toISOString(),
    generator: 'scripts/certification/run-certification.js',
    attestationType: 'https://slsa.dev/provenance/v1',
    builder: IN_CI ? 'GitHub Actions' : 'local',
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    repository: process.env.GITHUB_REPOSITORY ?? 'sayedelazameydesign-crypto/12pro',
    identity: manifest.identity,
    gateCounts: manifest.counts,
    /** Explicitly states what was and was not verified. */
    verificationStatement: {
      liveProvidersContacted: false,
      liveProviderStatus: 'UNKNOWN',
      e2eStatus: results.G5?.status ?? 'NOT_CERTIFIED',
      benchmarksNotMeasured: (results.G8?.benchmarks ?? []).filter((b) => b.status === 'NOT_MEASURED').map((b) => b.benchmark),
    },
  };
  mkdirSync(join(OUT, 'attestations'), { recursive: true });
  if (IS_SHA) {
    writeFileSync(join(OUT, 'attestations', `${COMMIT}.json`), `${JSON.stringify(attestation, null, 2)}\n`, 'utf-8');
  }
  writeFileSync(join(OUT, 'attestations', 'latest.json'), `${JSON.stringify(attestation, null, 2)}\n`, 'utf-8');
  return { gateOrder, reportMap, manifest, attestation, identityArtifact };
}

emitArtifacts('phase-1: evidence gates G0-G15, written before G16 reads them');

// --- G16: genetic identity -------------------------------------------------
{
  // The identity record must be regenerated bound to THIS commit, inside CI, before
  // the gate is evaluated. Commit is metadata; it never enters the fingerprint.
  const gen = runStep(
    'identity-generate',
    'node',
    ['scripts/identity/generate-genetic-fingerprint.ts', COMMIT ? `--commit=${COMMIT}` : '--unbound'],
    { tolerateFailure: true },
  );

  const verifyArgs = ['scripts/identity/verify-genetic-fingerprint.js', '--write-gate'];
  if (COMMIT) verifyArgs.push(`--commit=${COMMIT}`);
  if (REQUIRE_BINDING) verifyArgs.push('--require-commit-binding');
  const verify = runStep('identity-verify', 'node', verifyArgs, { tolerateFailure: true });

  const g16Path = join(OUT, 'gates', 'G16.json');
  let g16 = null;
  if (existsSync(g16Path)) {
    try {
      g16 = JSON.parse(readFileSync(g16Path, 'utf-8'));
    } catch (err) {
      console.error(`[certify] G16 artifact is unparsable: ${err.message}`);
    }
  }

  if (!g16) {
    results.G16 = gateArtifact(
      { gate: 'G16', name: 'Genetic Identity Gate', required: true, blocking: true },
      {
        status: 'NOT_CERTIFIED',
        tests: null,
        passed: null,
        failed: null,
        reason: `G16 produced no artifact (generate exit ${gen.exitCode}, verify exit ${verify.exitCode})`,
      },
    );
  } else {
    results.G16 = g16;
    // Re-assert the binding on the artifact the verifier wrote.
    if (REQUIRE_BINDING && g16.commit !== COMMIT) {
      results.G16.status = 'FAIL';
      results.G16.reason = `G16 artifact is bound to ${String(g16.commit)} but this run certifies ${COMMIT}`;
    }
  }
}

// The second emission is the authoritative one: it includes G16 and is what the
// binding assertion, the manifest consumers and the uploaded artifact all describe.
const { gateOrder, reportMap, manifest, attestation, identityArtifact } = emitArtifacts(
  'phase-2: final, includes G16',
);


// ------------------------------------------------------- final binding assertion

/**
 * The closure requirement:
 *   Remote HEAD == certified commit == manifest binding == evidence binding
 * Everything written above is checked here against the one resolved commit.
 */
function assertBindings() {
  const problems = [];
  const check = (label, file) => {
    if (!existsSync(file)) {
      problems.push(`${label}: missing artifact ${file}`);
      return;
    }
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf-8'));
    } catch (err) {
      problems.push(`${label}: unparsable ${file} (${err.message})`);
      return;
    }
    if (data.commit !== COMMIT) {
      problems.push(`${label}: ${file} is bound to ${String(data.commit)}, expected ${COMMIT}`);
    }
  };

  if (!REQUIRE_BINDING) return problems;

  check('manifest', join(OUT, 'manifests', 'latest.json'));
  check('manifest/release', join(OUT, 'manifests', 'release.json'));
  check('attestation', join(OUT, 'attestations', 'latest.json'));
  for (const name of gateOrder) {
    if (results[name]) check(`gate ${name}`, join(OUT, 'gates', `${name}.json`));
  }
  for (const [name] of reportMap) {
    check(`report ${name}`, join(OUT, 'reports', `${name}.json`));
  }
  check('report e2e', join(OUT, 'reports', 'e2e.json'));
  check('report eval safety', join(OUT, 'reports', 'evaluations', 'safety.json'));
  if (identityArtifact && identityArtifact.binding.commit !== COMMIT) {
    problems.push(`identity: record is bound to ${String(identityArtifact.binding.commit)}, expected ${COMMIT}`);
  }
  return problems;
}

const bindingProblems = assertBindings();

// ------------------------------------------------------------------- summary

console.log('');
console.log('[certify] ===================== GATE SUMMARY =====================');
for (const name of gateOrder) {
  const artifact = results[name];
  if (!artifact) continue;
  const counts =
    artifact.tests === null || artifact.tests === undefined
      ? ''
      : ` ${artifact.passed}/${artifact.tests}${artifact.failed ? ` (${artifact.failed} failed)` : ''}`;
  console.log(`[certify] ${name.padEnd(4)} ${String(artifact.status).padEnd(14)}${counts.padEnd(16)} ${artifact.blocking ? 'BLOCKING' : 'non-blocking'}`);
}
console.log('[certify] =================================================================');
console.log(`[certify] commit bound: ${COMMIT ?? '(unbound)'} [${COMMIT_SOURCE}]`);
if (manifest.identity) {
  console.log(`[certify] fingerprint : ${manifest.identity.fingerprint}`);
  console.log(`[certify] identityId  : ${manifest.identity.identityId}`);
  console.log(`[certify] binding match: ${manifest.identity.bindingMatchesManifest}`);
}
console.log(`[certify] gates: ${manifest.counts.pass} PASS, ${manifest.counts.partial} PARTIAL, ${manifest.counts.fail} FAIL, ${manifest.counts.notCertified} NOT_CERTIFIED`);

if (bindingProblems.length > 0) {
  console.error('');
  console.error(`[certify] BINDING FAILURE - ${bindingProblems.length} artifact(s) are not bound to the certified commit:`);
  for (const p of bindingProblems.slice(0, 40)) console.error(`[certify]   - ${p}`);
  process.exit(1);
}

const blockingFailures = gateOrder.filter((name) => {
  const artifact = results[name];
  return artifact && artifact.blocking && artifact.status !== 'PASS';
});

if (blockingFailures.length > 0) {
  console.error('');
  console.error(`[certify] CERTIFICATION FAILED - ${blockingFailures.length} blocking gate(s) not PASS: ${blockingFailures.join(', ')}`);
  for (const name of blockingFailures) {
    console.error(`[certify]   ${name}: ${results[name].status} - ${results[name].reason ?? '(no reason recorded)'}`);
  }
  process.exit(1);
}

console.log('');
console.log(`[certify] all ${gateOrder.filter((n) => results[n]?.blocking).length} blocking gate(s) PASS at commit ${COMMIT}`);
console.log('[certify] non-blocking gates are reported exactly as measured (PARTIAL / NOT_CERTIFIED are never upgraded to PASS).');
process.exit(0);
