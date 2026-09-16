# Branch Protection — Phase 4 configuration

Reviewed 2026-09-16 against the live repository. Updated after Phases 2–3.

## Current state

| Fact | Value |
|---|---|
| Visibility | public |
| Default branch | `main` |
| Branches | 22 |
| Rulesets configured | `[]` (none) |
| Classic branch protection | not readable by the agent token (403) |

Force-pushing and deleting `main` are still possible. The API token
(`arena-ai-coding-agent[bot]`) cannot write protection rules, so **these must be
applied by a human through the GitHub UI**. Everything below is the exact
configuration to enter.

---

## Phase 1 — apply now (no CI dependency)

Settings → Branches → Add branch ruleset (or Add rule) for `main`:

- **Restrict deletions** — on
- **Block force pushes** — on
- **Require a pull request before merging** — on, 1 approval
- **Dismiss stale approvals when new commits are pushed** — on

These are safe today: they do not depend on any check being green.

## Phase 4 — required status checks

### Prerequisite fixed: duplicate check names

Required-status-check rules match by **name only**, with no workflow qualifier.
Three names were defined in two workflows each, so a rule naming them would have
been ambiguous — and in one case actively misleading:

| Name | Was defined in | Status |
|---|---|---|
| `build` | `ci.yml` **and** `attestation.yml` | ci passes, attestation fails |
| `sbom` | `supply-chain.yml` **and** `attestation.yml` | one succeeds, one skips |
| `long-horizon` | `evaluation.yml` **and** `e2e.yml` | both pass |

Requiring `build` would have been satisfied by whichever run reported last.
Renamed the attestation/e2e copies to `attestation-build`, `attestation-sbom`
and `e2e-long-horizon`; each name now maps to exactly one job.

### Require these (verified green and able to fail)

```
lint
typecheck
typecheck-web
unit-test
build
integration
contract
regression
e2e
persistence-restart
capabilities
safety
long-horizon
swarm
tool-use
browser
certification-gate-G0-G3
```

Every one of these was confirmed green on commit `0d34062` **and** confirmed
capable of failing:

- `typecheck` / `certification-gate-G0-G3` — verified by injecting
  `const __x: number = "bad"` (gate exits 1)
- `tool-use` — verified by injecting a pending tool claiming `successRate: 0.99`
  with `usageCount: 0`
- `persistence-restart` — verified by making the disk write a no-op
- `e2e`, `browser` — previously passed only because their failures were
  swallowed; now genuinely run

Also enable **Require branches to be up to date before merging**.

### Do NOT require these yet

| Check | Why not |
|---|---|
| `dependency-audit` | 2 real vulns (`next` critical, `postcss` high) needing a breaking Next.js upgrade |
| `dependency-review` | flags the same advisories |
| `license-check` | `license-check.js` prints "No disallowed licenses found (simulated)" — always passes; not real |
| `attestation-build`, `provenance` | Docker image build fails in the attestation workflow |
| `certification-gate-G14` | reads a gate file with no executable definition; reports UNVERIFIED |
| `benchmark`, `compare`, `aggregate` | produce numbers nothing asserts against |
| `Test Vercel Ephemeral FS - Should Fail ...` | name asserts a failure mode; semantics need review before gating |

Requiring any of these today either blocks every PR or re-introduces a green
tick that proves nothing.

---

## Gate files are now generated, not hand-written

`certification/gates/*.json` were static constants pinned to commit `98f914b`.
After Phase 2 the gate re-runs the real commands, which made the stale `commit`
field fail the job under `--strict` even though all four commands passed:

```
[verify] G0 ... PASS
[verify] G0: gate file is pinned to 98f914b, not 5765b87 - stale
[verify] Gates FAILED
```

The fix is `--write`: the CI job now regenerates each gate file from the run
that just happened, recording the command, the real status and the actual
commit. Verified in both directions — passing run writes `"status": "PASS"` and
exits 0; injected type error writes `"status": "FAIL"` and exits 1.

This is the property that matters: the gate file is now a *product* of
verification rather than an input to it, so it cannot drift into claiming
something that was never checked.

---

## Applying the ruleset

UI path: Settings → Rules → Rulesets → New branch ruleset

- Target: `main`
- Enforcement: Active
- Rules: restrict deletions, block force pushes, require PR (1 approval),
  require status checks to pass + require branches up to date
- Status checks: paste the 17 names listed above

Equivalent API call, for whoever holds an admin token:

```bash
gh api -X POST repos/sayedelazameydesign-crypto/12pro/rulesets \
  -f name='main-protection' -f target='branch' -f enforcement='active' \
  -F 'conditions[ref_name][include][]=~DEFAULT_BRANCH' \
  -F 'rules[][type]=deletion' \
  -F 'rules[][type]=non_fast_forward'
# then add pull_request and required_status_checks rules with the names above
```

Verify afterwards:

```bash
gh api repos/sayedelazameydesign-crypto/12pro/rulesets
gh api repos/sayedelazameydesign-crypto/12pro/branches/main/protection
```

If the second still returns 403 for the agent token, that is expected; a human
or admin-scoped token must confirm.
