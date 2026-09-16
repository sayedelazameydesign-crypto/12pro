# CI Honesty Report — what the green ticks were hiding

Phase 2 + Phase 3, 2026-09-16. Run `c12397a` onward.

## Headline

Removing 30 `|| true` / `|| echo` escapes and 13 job-level `continue-on-error`
flags changed the CI board from **mostly green** to **partly red**. No code was
broken by this; the red checks were already failing and were being suppressed.

The board is now less pretty and considerably more useful.

---

## 1. A correction to an earlier claim

I previously reported "1141 pre-existing typecheck errors in `apps/web`" and
framed Phase 3 as substantial debt. That was wrong, and the error was mine.

The real picture:

| Config used | Errors |
|---|---|
| root `tsconfig.typecheck.json` (includes `apps/**/src/**/*`) | 1141 |
| `apps/web/tsconfig.json` (the app's own config) | **1** |

Breakdown of the 1141: 986 × `TS17004` ("Cannot use JSX unless the '--jsx' flag
is provided") and 103 × `TS2307` (unresolved `@/components/...`, `@/store/...`).
Both are artifacts of the root config lacking `jsx` and the `@/*` path aliases
that `apps/web/tsconfig.json` defines. They were noise, and the volume of that
noise hid the single genuine error.

Fixes:
- root typecheck config no longer globs `apps/**`; it lists `apps/api` and
  `apps/agent-ui` explicitly
- new `typecheck-web` CI job runs `tsc -p apps/web/tsconfig.json` so the app is
  still checked rather than quietly dropped from coverage
- the one real error fixed: `ApprovalRequest` was missing `metadata`

Result: root typecheck **0 errors**, `apps/web` typecheck **0 errors**.

## 2. Unit tests: 2 failing suites were unreachable, not failing

`vitest.config.ts` aliased 16 packages to their `src/`, but omitted
`@agi-system/intelligence-fabric` and 8 others. Those packages' `package.json`
point at `dist/`, which no test run builds — so the suites died at import with
"Failed to resolve entry for package".

Added the missing aliases. **6/6 suites, 31 tests pass** (was 4/6, 22 tests).
The 9 extra tests were always there; nothing could run them.

## 3. `verify-gates.js` did not verify anything

It read `certification/gates/*.json` and echoed the `status` field:

```js
const data = JSON.parse(fs.readFileSync(path.join(gatesDir,file),'utf-8'));
if (data.status !== 'PASS') allPass = false;
```

Those files are static and hand-committed. `G0.json` asserted *"Build & Lint &
Typecheck: PASS, 60/60, failed 0"* while the real typecheck was emitting 1141
errors, and it was pinned to commit `98f914b` — not HEAD.

Demonstrated exploit: editing `G0.json` to `99999/99999` produced
`[verify] G0: PASS (99999/99999)`, exit `0`.

Rewritten to execute the command each gate represents (`G0` → `npm run
typecheck`, `G1` → `npm run test:unit`, etc.), fail when a gate file claims PASS
while the command fails, and report gates with no executable definition as
`UNVERIFIED` instead of counting them as passes.

Verified both directions:
- inflating the JSON to `99999` no longer changes the verdict — the command runs
- injecting `const __broken: number = "not a number";` → `G0=FAIL`, **exit 1**

## 4. `build` was broken on `main` and hidden by `|| true`

`npm run build` fails on a clean clone of `main`:

```
packages/providers/src/index.ts(29,8): error TS2307:
  Cannot find module '@agi-system/intelligence-fabric'
```

`packages/providers/package.json` declares the dependency, but its
`tsconfig.json` had no project reference for it, so `tsc -b` never built it
first. `- run: npm run build || true` had been converting this into a green
tick. Fixed by adding the reference; `npm run build` now exits 0.

## 5. Checks that are now honestly red

These fail on real problems and are **not** regressions from this work:

| Check | Cause | Action |
|---|---|---|
| `dependency-audit` | 7 vulns: `next`, `vitest` (critical), `postcss`, `vite` (high) | all need breaking major upgrades — separate PR |
| `dependency-review` | flags the same advisories on the PR diff | same |
| `license-check` | CI's `npx license-checker` step; the repo's own `license-check.js` passes and self-describes as "simulated" | replace the simulated script or drop the claim |
| `e2e`, `browser` | Playwright suites genuinely failing | triage separately |
| `capabilities`, `tool-use`, `benchmark` | were writing `{"status":"PASS"}` on failure | triage separately |
| `certification-gate-G14` | now runs a real check instead of echoing a file | expected |
| `Test Vercel Ephemeral FS` | named "Should Fail" — asserts Vercel loses data | inspect; may be intentional |

Note `license-check.js` prints *"No disallowed licenses found (simulated) -
PASS"*. It is a placeholder that always passes. It should not be a required
check until it actually inspects licenses.

## 6. Effect on the branch-protection plan

Phase 4 can now begin, but only with the checks that are genuinely green and
genuinely capable of failing:

**Safe to require now:**
`lint`, `typecheck`, `typecheck-web`, `unit-test`, `integration`, `contract`,
`build`, `persistence-restart`

**Do not require yet:** `dependency-audit`, `dependency-review`, `e2e`,
`browser`, `capabilities`, `tool-use`, `benchmark`, `certification-gate-*`,
`license-check` — each is either legitimately failing or not yet trustworthy.

Requiring the first list gives real protection today. Adding the second list
before fixing it would block all merges; adding it while still faked would be
worse than requiring nothing.

---

# Addendum — e2e / browser triage

All three failures were infrastructure, not test logic. The tests themselves
were trivial and always would have passed.

## 1. `e2e` — an invalid CLI flag

```
$ npm run test:e2e -- --reporter=json --output-file=certification/reports/e2e.json
error: unknown option '--output-file=certification/reports/e2e.json'
```

Playwright has no `--output-file`; the json reporter's `outputFile` is set in
`playwright.config.ts`. The CLI exited 1 before running a single test, and
`|| echo '{"status":"PASS"}' > certification/reports/e2e.json` then wrote a
passing report over the failure. Removing the flag: **1 passed (39.4s)**.

## 2. `browser` — config contradicting itself

`evaluation.yml` ran `vitest run evaluations/browser`, but `vitest.config.ts`
listed `evaluations/browser/**` in `exclude`. Vitest found no files and exited
1 every time:

```
exclude:  tests/e2e/**, tests/browser/**, evaluations/browser/**
No test files found, exiting with code 1
```

`evaluations/browser/web-task.eval.ts` is a plain vitest spec, so the exclusion
was wrong. Only the Playwright-owned directories stay excluded.

## 3. `tool-use` — evaluating a directory that did not exist

`evaluations/tool-use/` was never created, yet `package.json` ("eval:tool-use",
"eval:all") and `evaluation.yml` both referenced it. Same silent failure mode:
no files, exit 1, fake report written.

Worse, `certification/benchmarks/tool-use.json` claimed:

```json
{ "benchmark": "tool-use", "toolCallsPerSec": 42.5, "successRate": 0.98, "status": "PASS" }
```

— a 98% success rate for a suite that had never run.

Rather than delete the reference, the suite now exists and asserts against the
real exported `TOOL_REGISTRY`: 16 unique ids, the documented 14/2
available-pending split, `enabled` consistent with `status`, a `pendingReason`
on every pending tool, valid category values, ranges on `successRate` /
`avgLatencyMs`, and agreement with `ToolsService`.

It includes the rule the old benchmark violated: **a tool with `usageCount: 0`
must not advertise a success rate.** Verified by injecting a pending tool
claiming `successRate: 0.99` with zero usage:

```
× reports success rates and latencies within valid ranges
  → vision claims a success rate with 0 usage: expected 0.99 to be +0
```

## 4. A missing dependency this uncovered

Starting the e2e web server failed with `npm error code 127 ... command sh -c
tsx src/index.ts`. Seven packages (`apps/api`, `apps/agent-ui`,
`services/{api-server,worker,scheduler,webhook}`, `packages/intelligence-fabric`)
use `tsx` in their `dev` script, but nothing declared it. Added to root
devDependencies.

## Status after triage

| Check | Before | After |
|---|---|---|
| `e2e` | fail (invalid flag) | **pass** |
| `browser` | fail (excluded path) | **pass** |
| `tool-use` | fail (no such dir) | **pass** (7 real assertions) |
| `capabilities` | fail | **pass** (fixed by vitest aliases) |
| `safety`, `long-horizon`, `swarm` | pass | pass |

Still legitimately red and out of scope here: `dependency-audit` /
`dependency-review` (7 vulns, 2 critical — breaking upgrades),
`certification-gate-G14`, `benchmark`, and `license-check` (whose script still
self-describes as "simulated").

## 5. `e2e` round two — duplicate server start

Removing the invalid flag made e2e pass locally but it still failed in CI. The
cause was a second, independent bug: the workflow started the dev server
itself *and* `playwright.config.ts` defines a `webServer` with
`reuseExistingServer: !process.env.CI`. Under CI that is `false`, so playwright
tried to bind a port the workflow had already taken:

```
Error: http://localhost:3000 is already used, make sure that nothing is running
on the port/url or set reuseExistingServer:true in config.webServer.
```

Locally it passed only because `reuseExistingServer` is `true` off-CI — a
textbook works-on-my-machine divergence. Reproduced deliberately by starting a
server and running `CI=true npx playwright test` (exit 1), and confirmed fixed
by running `CI=true npx playwright test` with no pre-started server:
**1 passed (38.4s)**.

The workflow now only builds; playwright owns the server lifecycle.

---

# Addendum — vitest / vite security upgrade

## Correction: there was no "secure patch" to bump to

The plan called for bumping to "latest secure patches". No such patch exists.
`vitest@2.1.9` is the newest 2.x release, and the advisory ranges are:

| Advisory | Severity | Vulnerable | Fixed in |
|---|---|---|---|
| GHSA-5xrq-8626-4rwp | critical | `vitest <3.2.6` | 3.2.6 |
| GHSA-82fw-gwwq-j7x9 | moderate | `@vitest/mocker >=2.1.0 <4.1.11` | **4.1.11** |
| GHSA-fx2h-pf6j-xcff | high | `vite <=6.4.2` | 6.4.3 / 7 / 8 |
| GHSA-4w7w-66w2-5vf9 | moderate | `vite <=6.4.1` | — |
| GHSA-67mh-4wv8-2f99 | moderate | `esbuild <=0.24.2` | — |

Staying on 2.x fixes nothing. The minimum version clearing every vitest-side
advisory is **4.1.11** — a two-major jump, not a patch.

## Why 4.1.11 and not 5.0.1 (the `npm audit` suggestion)

`npm audit fix --force` proposes `vitest@5.0.1`. That would break CI:

```
vitest@5.0.1 engines: { node: "^22.12.0 || ^24.0.0 || >=26.0.0" }
vitest@4.1.11 engines: { node: "^20.0.0 || ^22.0.0 || >=24.0.0" }
```

All 30 CI jobs pin `node-version: 20`, and `package.json` declares
`"node": ">=20.0.0"`. Taking audit's advice would have required a Node bump
across every workflow as collateral. 4.1.11 clears the same advisories and
runs on Node 20.

`vite` resolved to 8.3.0 (engines `^20.19.0 || >=22.12.0`, satisfied by the
Node 20.x line CI installs).

## Result

**7 vulnerabilities → 2.** All 3 moderate and 1 of 2 high resolved; the
remaining critical + high are both the `next` chain (`next`, and `postcss`
nested under it), which is the separate Next.js upgrade.

## Compatibility verified on vitest 4

Every suite re-run after a clean `rm -rf node_modules && npm ci`:

| Suite | Result |
|---|---|
| unit (6 files, 31 tests) | pass |
| integration, contract, regression, security, acceptance | pass |
| evals: capabilities, safety, long-horizon, tool-use, swarm, browser | pass |
| e2e (playwright) | pass |
| typecheck, build, lint, verify-gates G0–G3 | pass |

No test code or config needed changing for the v2 → v4 migration.

## Two side-fixes this surfaced

1. **`npm test` was already broken on `main`.** `vitest.config.ts` configures a
   v8 coverage provider, but `@vitest/coverage-v8` was never declared:
   `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'`. Confirmed
   absent from `main`'s `package.json` too, so this predates the upgrade. Added
   at 4.1.11; `npm test` now runs and reports coverage.

2. **`npm install` hits an npm 10 arborist bug** on vitest's optional peer set
   (`TypeError: Cannot read properties of null (reading 'edgesOut')`). Worked
   around with `--legacy-peer-deps` for the install. The resulting lockfile was
   then validated against a plain `npm ci` — exactly what CI runs — which
   succeeds, so no workflow change is needed.
