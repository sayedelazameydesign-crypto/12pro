#!/usr/bin/env node
/**
 * Shared repository inspections used by certification.
 *
 * These are deliberately structural: they read what is actually on disk and report
 * what they found. None of them can return a passing verdict from a declaration or
 * a label, which is what made the previous certification unverifiable.
 *
 * Consumed by:
 *   - scripts/certification/run-certification.js   (the orchestrator)
 *   - scripts/verification/check-e2e-status.js     (standalone E2E honesty check)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Detect placeholder E2E tests.
 *
 * A placeholder is a test whose only assertion is a tautology, or one that is
 * marked `test.fixme` / self-declares as a placeholder without exercising a real
 * surface. Reporting one as a passing end-to-end suite is how a system claims
 * browser-level coverage it does not have.
 */
export function detectE2EPlaceholders(root = process.cwd()) {
  const dir = join(root, 'tests', 'e2e');
  if (!existsSync(dir)) return { dirExists: false, files: [], placeholders: [], real: [] };

  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(d, entry.name))
        : entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')
          ? [join(d, entry.name)]
          : [],
    );

  const files = walk(dir).map((f) => f.replace(`${root}/`, '')).sort();
  const placeholders = [];
  const real = [];

  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf-8');
    const tautological = /expect\(\s*true\s*\)\.toBeTruthy\(\)/.test(text);
    const markedPlaceholder = /placeholder/i.test(text);
    const markedFixme = /test\.fixme|test\.skip|describe\.skip|it\.skip/.test(text);
    const selfDeclaredPartial = /E2E_STATUS\s*=\s*['"]PARTIAL['"]/.test(text);
    // A real assertion against an actual surface: request/page/context usage plus a
    // non-tautological expect.
    const exercisesRealSurface =
      /\b(?:request|page|context)\s*\.\s*(?:get|post|put|delete|patch|goto|click|fill)\s*\(/.test(text) &&
      /expect\((?!\s*true\s*\))/.test(text);

    const isPlaceholder =
      tautological || markedFixme || selfDeclaredPartial || (markedPlaceholder && !exercisesRealSurface);

    if (isPlaceholder) {
      placeholders.push({
        path: rel,
        tautological,
        markedPlaceholder,
        markedFixme,
        selfDeclaredPartial,
        exercisesRealSurface,
      });
    } else {
      real.push(rel);
    }
  }

  return { dirExists: true, files, placeholders, real };
}

/** Machine-readable E2E status derived from the detection above. */
export function e2eStatus(root = process.cwd()) {
  const detection = detectE2EPlaceholders(root);
  if (!detection.dirExists || detection.files.length === 0) {
    return { status: 'NOT_CERTIFIED', reason: 'no tests/e2e suite exists', detection };
  }
  if (detection.real.length === 0) {
    return {
      status: 'PARTIAL',
      reason:
        `All ${detection.files.length} E2E file(s) are placeholders. No browser-level behaviour has been exercised, ` +
        'so this is reported as PARTIAL and never as PASS.',
      detection,
    };
  }
  if (detection.placeholders.length > 0) {
    return {
      status: 'PARTIAL',
      reason:
        `${detection.real.length} real E2E file(s) and ${detection.placeholders.length} placeholder(s) - ` +
        'partial coverage is reported as PARTIAL, not PASS.',
      detection,
    };
  }
  return { status: 'MEASURED', reason: `${detection.real.length} E2E file(s) exercise a real surface`, detection };
}

/** Documentation presence - a real, checkable requirement. */
export function inspectDocumentation(root = process.cwd()) {
  const required = [
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'SECURITY.md',
    'docs/BLUEPRINT.md',
    'docs/CAPABILITY-MATRIX.md',
    'docs/ATOMIC-CORE-SPEC.md',
  ];
  const missing = required.filter((p) => !existsSync(join(root, p)));
  const docsDir = join(root, 'docs');
  const docFiles = existsSync(docsDir)
    ? readdirSync(docsDir, { recursive: true }).filter((f) => String(f).endsWith('.md')).length
    : 0;
  return { required, missing, present: required.length - missing.length, docFiles };
}

/** Release readiness - real, checkable preconditions. */
export function inspectReleaseReadiness(root = process.cwd()) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
  const checks = [
    { id: 'version-declared', ok: typeof pkg.version === 'string' && /^\d+\.\d+\.\d+/.test(pkg.version), detail: `version=${pkg.version}` },
    { id: 'repository-declared', ok: Boolean(pkg.repository?.url), detail: `repository=${pkg.repository?.url ?? 'missing'}` },
    { id: 'license-declared', ok: Boolean(pkg.license), detail: `license=${pkg.license ?? 'missing'}` },
    { id: 'release-workflow', ok: existsSync(join(root, '.github/workflows/release.yml')), detail: '.github/workflows/release.yml' },
    { id: 'sbom-artifact', ok: existsSync(join(root, 'certification/sbom/sbom.spdx.json')), detail: 'certification/sbom/sbom.spdx.json' },
    {
      id: 'changelog-nonempty',
      ok: existsSync(join(root, 'CHANGELOG.md')) && readFileSync(join(root, 'CHANGELOG.md'), 'utf-8').trim().length > 50,
      detail: 'CHANGELOG.md',
    },
  ];
  return { checks, ok: checks.filter((c) => c.ok).length, total: checks.length };
}

/**
 * Workflow hardening inspection.
 *
 * A step whose failure is swallowed cannot certify anything. This reads the real
 * workflow files and reports exactly which constructs can hide a failure.
 */
export function inspectWorkflowHardening(root = process.cwd()) {
  const dir = join(root, '.github', 'workflows');
  if (!existsSync(dir)) return { total: 0, hardened: 0, offenders: [] };

  /**
   * Infrastructure steps whose failure is genuinely optional. These certify nothing:
   * they publish or fetch, and a failure is visible in the job log and the artifact
   * list. Everything else must fail loudly.
   */
  const TOLERATED = [
    'npx playwright install',
    'gh release view',
    'npm publish',
    // `npm audit --json` exits non-zero when advisories exist; the JSON is captured
    // here and EVALUATED (blocking) by the next step, so capturing must not abort.
    'npm audit --json',
    'npm audit --omit=dev --json',
    'actions/upload-artifact',
    'actions/download-artifact',
    'actions/attest-',
    'anchore/sbom-action',
    'docker/build-push-action',
    'actions/dependency-review-action',
  ];

  const files = readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml')).sort();
  const offenders = [];

  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf-8');
    const lines = text.split('\n');
    const problems = [];

    /**
     * The action a step uses, found by scanning BOTH directions from a
     * `continue-on-error` line. Step keys can appear in any order, so looking only
     * backwards misses the common `- name: / id: / continue-on-error: / uses:` form.
     */
    const stepAction = (index) => {
      // Backwards: find the step this key belongs to. A list item that carries no
      // `uses:` of its own (the usual `- name: ... / continue-on-error: ... / uses: ...`
      // ordering) is NOT a dead end - fall through to the forward scan.
      let reachedStepStart = false;
      for (let i = index; i >= 0 && i > index - 10; i--) {
        const l = lines[i] ?? '';
        if (i !== index && /^\s*-\s/.test(l)) {
          const usesHere = /uses:\s*([^\s@]+)/.exec(l);
          if (usesHere?.[1]) return usesHere[1];
          if (/-\s*run:/.test(l)) return 'run';
          reachedStepStart = true;
          break;
        }
        const uses = /uses:\s*([^\s@]+)/.exec(l);
        if (uses?.[1]) return uses[1];
        if (/^\s*(-\s*)?run:/.test(l)) return 'run';
      }
      // Forwards: the `uses:` / `run:` that follows within the same step.
      const from = reachedStepStart ? index + 1 : index;
      for (let i = from; i < lines.length && i < index + 8; i++) {
        const l = lines[i] ?? '';
        if (/^\s*-\s/.test(l)) break; // next step begins
        const uses = /uses:\s*([^\s@]+)/.exec(l);
        if (uses?.[1]) return uses[1];
        if (/^\s*run:/.test(l)) return 'run';
      }
      return null;
    };

    lines.forEach((line, index) => {
      // COMMENT LINES ARE NOT STEPS.
      // Documentation that quotes a forbidden construct (for example a comment
      // explaining that `|| echo` was removed) must not be reported as using it.
      if (line.trimStart().startsWith('#')) return;

      const constructs = [];
      if (/\|\|\s*echo\b/.test(line)) constructs.push('|| echo');
      if (/\|\|\s*true\b/.test(line)) constructs.push('|| true');
      if (/continue-on-error:\s*true/.test(line)) constructs.push('continue-on-error: true');
      if (constructs.length === 0) return;

      const textTolerated = TOLERATED.some((needle) => line.includes(needle));
      if (textTolerated) return;

      if (/continue-on-error:\s*true/.test(line)) {
        const action = stepAction(index);
        // Job-level continue-on-error (indent 4, no owning step) is never tolerated:
        // it hides the failure of an ENTIRE job, including every real check in it.
        const isJobLevel = /^ {4}continue-on-error:/.test(line) && action === null;
        // A `run:` step is never tolerated: its failure is our own code, and our own
        // code is what the certification is claiming something about.
        const actionTolerated =
          action !== null && action !== 'run' && TOLERATED.some((n) => action === n || action.startsWith(n));
        if (!isJobLevel && actionTolerated) return;
      }

      problems.push({ line: index + 1, constructs, text: line.trim().slice(0, 140) });
    });

    if (problems.length > 0) offenders.push({ file, problems });
  }

  return { total: files.length, hardened: files.length - offenders.length, offenders };
}
