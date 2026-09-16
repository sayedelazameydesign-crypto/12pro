#!/usr/bin/env node
/**
 * Verify certification gates.
 *
 * Previously this script read certification/gates/*.json and echoed the
 * "status" field back. Those files are static, hand-committed constants, so
 * the gate reported PASS regardless of the state of the code: editing
 * G0.json to {"passed":99999} produced "G0: PASS (99999/99999)", exit 0,
 * while the real typecheck was emitting 1141 errors.
 *
 * A gate that cannot fail is not a gate. This version:
 *   1. RUNS the command a gate claims to represent, and
 *   2. fails when the gate file disagrees with reality, is stale (pinned to a
 *      different commit), or is missing.
 *
 * Gates with no executable definition are reported UNVERIFIED and — in strict
 * mode — treated as failures rather than silently counted as passes.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const arg = (name) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}`));
  if (!hit) return null;
  return hit.includes('=') ? hit.split('=')[1] : process.argv[process.argv.indexOf(hit) + 1] ?? null;
};

const requestedGates = arg('gates')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const commitArg = arg('commit') || 'local';
const strict = process.argv.includes('--strict');
const report = process.argv.includes('--report');
// --write regenerates each gate file from the observed result of this run.
const write = process.argv.includes('--write');

/**
 * Executable definition of each gate. `run` must exit non-zero on failure.
 * Anything not listed here has no way to be verified automatically.
 */
const GATE_COMMANDS = {
  G0: { name: 'Build & Lint & Typecheck', run: 'npm run typecheck' },
  G1: { name: 'Unit tests',               run: 'npm run test:unit' },
  G2: { name: 'Integration tests',        run: 'npm run test:integration' },
  G3: { name: 'Contract tests',           run: 'npm run test:contract' },
};

const gatesDir = 'certification/gates';
const results = [];
let allPass = true;

console.log(`[verify] Verifying gates for commit ${commitArg}${strict ? ' (strict)' : ''}`);

const gateNames = requestedGates
  ?? (fs.existsSync(gatesDir)
        ? fs.readdirSync(gatesDir).filter(f => f.endsWith('.json')).map(f => path.basename(f, '.json'))
        : []);

if (gateNames.length === 0) {
  console.error('[verify] No gates selected - nothing was verified.');
  process.exit(strict ? 1 : 0);
}

for (const gate of gateNames) {
  const spec = GATE_COMMANDS[gate];
  const file = path.join(gatesDir, `${gate}.json`);
  let claim = null;

  if (fs.existsSync(file)) {
    try {
      claim = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (e) {
      console.error(`[verify] ${gate}: gate file is invalid JSON - ${e.message}`);
      allPass = false;
      results.push({ gate, result: 'INVALID_FILE' });
      continue;
    }
  }

  // No executable definition: we cannot confirm anything about this gate.
  if (!spec) {
    console.warn(`[verify] ${gate}: UNVERIFIED - no command defined; a committed "${claim?.status ?? 'n/a'}" is not evidence`);
    results.push({ gate, result: 'UNVERIFIED', claimed: claim?.status ?? null });
    if (strict) allPass = false;
    continue;
  }

  // Actually run it.
  let actualPass = true;
  let detail = '';
  process.stdout.write(`[verify] ${gate} (${spec.name}): running \`${spec.run}\` ... `);
  try {
    execSync(spec.run, { stdio: 'pipe', encoding: 'utf-8' });
  } catch (e) {
    actualPass = false;
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    detail = out.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300);
  }
  console.log(actualPass ? 'PASS' : 'FAIL');
  if (detail) console.log(`           ${detail}`);

  if (!actualPass) allPass = false;

  // Cross-check the committed claim against what actually happened.
  if (claim) {
    if (claim.status === 'PASS' && !actualPass) {
      console.error(`[verify] ${gate}: gate file claims PASS but the command FAILED - stale or fabricated evidence`);
      allPass = false;
    }
    if (claim.commit && commitArg !== 'local' && claim.commit !== commitArg) {
      const msg = `[verify] ${gate}: gate file is pinned to ${String(claim.commit).slice(0, 7)}, not ${String(commitArg).slice(0, 7)} - stale`;
      if (write) {
        // Being regenerated below from this run's result, so staleness is cured.
        console.log(`${msg} (regenerating)`);
      } else {
        console.warn(msg);
        if (strict) allPass = false;
      }
    }
  }

  results.push({ gate, result: actualPass ? 'PASS' : 'FAIL', claimed: claim?.status ?? null });

  // Rewrite the gate file from the run that just happened, so it records
  // observed reality at this commit instead of a hand-edited constant. This is
  // what stops the files going stale and being cited as evidence later.
  if (write) {
    fs.mkdirSync(gatesDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      gate,
      name: spec.name,
      status: actualPass ? 'PASS' : 'FAIL',
      commit: commitArg,
      timestamp: new Date().toISOString(),
      command: spec.run,
      verifiedBy: 'scripts/verification/verify-gates.js',
      required: claim?.required ?? true,
      blocking: claim?.blocking ?? true
    }, null, 2) + '\n');
  }
}

if (report) {
  fs.mkdirSync(gatesDir, { recursive: true });
  const out = path.join(gatesDir, `verification-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify({ commit: commitArg, timestamp: new Date().toISOString(), strict, results }, null, 2));
  console.log(`[verify] report written to ${out}`);
}

const summary = results.map(r => `${r.gate}=${r.result}`).join(' ');
console.log(`[verify] ${summary}`);

if (!allPass) {
  console.error('[verify] Gates FAILED');
  process.exit(1);
}
console.log('[verify] All selected gates verified against real command output');
