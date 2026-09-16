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
