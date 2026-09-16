# Branch Protection — findings and a safe order of operations

Reviewed 2026-09-16 against the live repository via the GitHub API.

## Summary

Protecting `main` is the right call, but **"require status checks to pass"
cannot be enabled as-is**: `main`'s own CI is currently red, and several
"certification" checks pass without verifying anything. Turning the rule on
today would either block every PR, or — worse — grant a green tick that means
nothing.

---

## 1. Verified repository state

| Fact | Value |
|---|---|
| Visibility | public |
| Default branch | `main` |
| Branches | 22 |
| Tags | 1 (`v1.0.0`) |
| Rulesets configured | `[]` (none) |
| Classic branch protection | not readable by this token (403) — treat as unset |

The screenshot's "Your main branch isn't protected" banner is consistent with
`rulesets == []`: force-push and deletion of `main` are currently possible.

## 2. `main` CI is failing

Last push to `main` (`c314199`, merge of PR #15), workflow *CI - Build / Lint /
Typecheck / Unit* → **failure**:

```
success  install
failure  typecheck
failure  unit-test
success  lint
skipped  build
skipped  certification-gate-G0-G3
```

*Deploy - Staging / Production* on the same commit also failed.

Reproduced locally on a clean clone of `main`:

```
npm run typecheck  → 1141 errors  (apps/web: missing --jsx flag, @/lib/api/client unresolved)
npm run test:unit  → 2 suites fail (@agi-system/intelligence-fabric entry unresolvable)
```

So `main` is red **on its own merits**, independent of any open PR.

## 3. Some green checks are not real checks

`ci.yml` and `evaluation.yml` neutralise their own gates:

```yaml
- run: npm run build || true
- run: node scripts/verification/verify-gates.js --gates G0,G1,G2,G3 ... || echo "gate check done"
- run: node scripts/verification/verify-gates.js --gates G14 --strict  || echo "G14 check completed"
```

`|| true` / `|| echo` force exit code 0, so the step reports success no matter
what happens. `supply-chain.yml` and `attestation.yml` carry 8 `continue-on-error:
true` steps each; 38 `|| true`-style escapes exist across the workflows.

Worse, `scripts/verification/verify-gates.js` does not test anything. It reads
committed JSON files and echoes the `status` field back:

```js
const data = JSON.parse(fs.readFileSync(path.join(gatesDir,file),'utf-8'));
if (data.status !== 'PASS') allPass = false;
```

`certification/gates/G0.json` is a static, committed file claiming:

```json
{ "gate": "G0", "name": "Build & Lint & Typecheck", "status": "PASS",
  "tests": 60, "passed": 60, "failed": 0, "commit": "98f914b..." }
```

Three problems:

1. It asserts *Build & Lint & Typecheck: 60/60, 0 failed* while the real
   typecheck emits **1141 errors** and the CI typecheck job fails.
2. It is pinned to commit `98f914b`, which is not current `HEAD` — the result
   is stale and nothing checks the commit matches.
3. Editing the number is enough to change the verdict. Setting `passed`/`tests`
   to `99999` yields `[verify] G0: PASS (99999/99999)`, exit `0`.

`certification-gate-G14` is therefore a green tick that proves only that a file
containing the word `PASS` is committed. It must not be a required check.

## 4. Recommended order

**Do not enable required status checks first.** Sequence:

**Step 1 — protect against irreversible damage now.** These are safe today and
cost nothing, because they do not depend on CI being green:

- Block force pushes to `main`
- Block deletion of `main`
- Require a pull request before merging (1 approval)

**Step 2 — make the checks honest.** Remove the escapes so a failure is
visible:

- delete `|| true` / `|| echo "..."` from `ci.yml` and `evaluation.yml`
- justify or delete each `continue-on-error: true`
- either make `verify-gates.js` derive results from the actual test/typecheck
  run, or drop the G0–G15 gate files and the checks that read them

**Step 3 — get `main` green.** Fix the 1141 typecheck errors (largely
`apps/web` needing `"jsx": "react-jsx"` and a path alias for `@/lib/api/client`)
and the unresolved `@agi-system/intelligence-fabric` entry point.

**Step 4 — only then require status checks.** Start with checks that genuinely
fail when the code is broken:

```
lint, typecheck, unit-test, build, integration, contract, e2e
```

Add `dependency-review`, `license-check`, `sbom` once they are confirmed not to
be `continue-on-error`. Also enable *Require branches to be up to date before
merging*.

## 5. Why not enable everything at once

Requiring `typecheck` today blocks all merges, including the fixes for
`typecheck`. Requiring `certification-gate-G14` today is worse than requiring
nothing: it signals verification while asserting only that a hand-written JSON
file says `PASS`. A protection rule that cannot fail is not protection — it is
a claim of safety that has not been earned.
