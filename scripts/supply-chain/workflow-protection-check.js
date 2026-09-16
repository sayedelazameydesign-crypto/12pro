#!/usr/bin/env node
/**
 * Workflow execution protection check (2026).
 *
 * This script used to be six `console.log` calls ending in an unconditional "PASS".
 * It verified nothing. It now parses every workflow file and fails on real findings.
 *
 * What it checks:
 *   1. least privilege      - every job or workflow declares `permissions:`
 *   2. no hidden failures   - no `|| echo`, `|| true` or `continue-on-error: true`
 *                             on a step whose failure must block certification
 *   3. no fork secret leak  - `pull_request_target` must not check out and run the
 *                             PR head with secrets in scope
 *   4. pinned actions       - third-party actions are referenced by tag or SHA, and
 *                             mutable `@main`/`@master` references are reported
 *
 * Exit codes: 0 = all checks pass, 1 = findings present, 2 = unusable input.
 * With `--strict`, warnings are promoted to failures.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inspectWorkflowHardening } from '../certification/lib/inspect.js';

const STRICT = process.argv.includes('--strict');
const WORKFLOW_DIR = '.github/workflows';

/**
 * Hidden-failure detection is NOT defined here.
 *
 * It lives in scripts/certification/lib/inspect.js, which is the same implementation
 * certification gate G10 uses. This script previously carried its own copy with a
 * different tolerance list and a narrower look-back window, so the two disagreed:
 * G10 reported workflows that hide failures while this script reported none, and the
 * disagreement was invisible because both printed PASS. One definition, two callers.
 */
const HARDENING = inspectWorkflowHardening(process.cwd());
const OFFENDERS_BY_FILE = new Map(HARDENING.offenders.map((o) => [o.file, o.problems]));

function parseWorkflows(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort()
    .map((file) => ({ file, path: join(dir, file), text: readFileSync(join(dir, file), 'utf-8') }));
}

/** Collect job ids declared under a top-level `jobs:` block. */
function jobIds(text) {
  const ids = [];
  let inJobs = false;
  for (const line of text.split('\n')) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (inJobs) {
      if (/^\S/.test(line) && line.trim().length > 0) {
        inJobs = false;
        continue;
      }
      const match = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
      if (match?.[1]) ids.push(match[1]);
    }
  }
  return ids;
}

/** Detect the fork-secret-leak pattern. */
function forkSecretLeak(workflow) {
  // NOTE: this line used to read `if (!triggerPullRequestTarget)`, a name that was
  // never defined. The fork-secret-isolation check therefore threw a ReferenceError on
  // every run and reported nothing at all - a governance check that crashes silently
  // is indistinguishable from one that passes. Fixed by using the declared name.
  const triggersPullRequestTarget = /(^|\n)\s*pull_request_target\s*:/.test(workflow.text);
  if (!triggersPullRequestTarget) return null;
  const checksOutPrHead = /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/.test(workflow.text);
  const usesSecrets = /secrets\./.test(workflow.text);
  if (checksOutPrHead && usesSecrets) {
    return 'pull_request_target checks out the PR head AND references secrets - untrusted code would run with credentials';
  }
  return null;
}

/** Find mutable action references. */
function mutableActionRefs(workflow) {
  const refs = [];
  for (const match of workflow.text.matchAll(/uses:\s*([A-Za-z0-9_.\-/]+)@(main|master)\b/g)) {
    refs.push(`${match[1]}@${match[2]}`);
  }
  return refs;
}

function main() {
  const workflows = parseWorkflows(WORKFLOW_DIR);
  if (workflows.length === 0) {
    console.error(`[workflow-protection] no workflows found under ${WORKFLOW_DIR}`);
    return 2;
  }

  const failures = [];
  const warnings = [];
  const checked = { workflows: workflows.length, jobs: 0, permissionsDeclared: 0 };

  console.log(`[workflow-protection] inspecting ${workflows.length} workflow file(s) (strict=${STRICT})`);

  for (const workflow of workflows) {
    const ids = jobIds(workflow.text);
    checked.jobs += ids.length;

    // 1. least privilege
    const hasTopLevelPermissions = /(^|\n)permissions:\s*\n/.test(workflow.text);
    if (hasTopLevelPermissions) checked.permissionsDeclared += 1;

    if (!hasTopLevelPermissions && ids.length > 0) {
      // A workflow with jobs but no declared permissions inherits the default token
      // scope, which is broader than any of these jobs need.
      failures.push({
        file: workflow.file,
        check: 'least-privilege',
        detail: `declares ${ids.length} job(s) but no top-level \`permissions:\` block - the default token scope is broader than required`,
      });
    }
    if (/permissions:\s*\n\s*[^#\n]*write-all/i.test(workflow.text)) {
      failures.push({ file: workflow.file, check: 'least-privilege', detail: 'requests write-all permissions' });
    }

    // 2. hidden failures - delegated to the shared inspector, so this check and
    //    gate G10 cannot diverge. Comment lines are excluded there: documentation
    //    that QUOTES a forbidden construct is not the same as using it.
    for (const problem of OFFENDERS_BY_FILE.get(workflow.file) ?? []) {
      failures.push({
        file: workflow.file,
        check: 'no-hidden-failures',
        detail: `line ${problem.line}: ${problem.constructs.join(', ')} -> ${problem.text.slice(0, 110)}`,
      });
    }

    // 3. fork secret leak
    const leak = forkSecretLeak(workflow);
    if (leak) failures.push({ file: workflow.file, check: 'fork-secret-isolation', detail: leak });

    // 4. mutable action references
    for (const ref of mutableActionRefs(workflow)) {
      warnings.push({ file: workflow.file, check: 'pinned-actions', detail: `mutable action reference ${ref} - pin to a tag or SHA` });
    }
  }

  console.log(`[workflow-protection] jobs=${checked.jobs} workflows-with-permissions=${checked.permissionsDeclared}/${checked.workflows}`);
  console.log(
    `[workflow-protection] hardened workflows=${HARDENING.hardened}/${HARDENING.total} ` +
      `(offenders: ${HARDENING.offenders.map((o) => o.file).join(', ') || 'none'})`,
  );

  for (const warning of warnings) {
    console.warn(`[workflow-protection] WARN  ${warning.file} [${warning.check}] ${warning.detail}`);
  }
  for (const failure of failures) {
    console.error(`[workflow-protection] FAIL  ${failure.file} [${failure.check}] ${failure.detail}`);
  }

  const effectiveFailures = STRICT ? failures.length + warnings.filter((w) => !w.allowListed).length : failures.length;

  if (effectiveFailures > 0) {
    console.error(`[workflow-protection] ${effectiveFailures} finding(s) - workflow protections are NOT satisfied`);
    return 1;
  }

  console.log(`[workflow-protection] PASS - ${failures.length === 0 ? 'no' : 'no blocking'} findings across ${checked.workflows} workflow(s)`);
  if (warnings.length > 0) {
    console.log(`[workflow-protection] ${warnings.length} non-blocking warning(s) reported above; they are NOT counted as passes.`);
  }
  return 0;
}

process.exit(main());
