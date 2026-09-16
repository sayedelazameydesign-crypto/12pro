# Certification Record

**Read the status line before anything else.**

> ## This document is NOT a certification.
>
> It is a human-readable statement of what the pipeline measured, what it refused to
> measure, and where the authoritative record lives. The certification is the
> **`certification` artifact** produced by `.github/workflows/certification.yml` on a
> specific remote commit. If this file and that artifact disagree, the artifact is right
> and this file is stale.

---

## 1. Why this file is not the certification

A certification is a claim that a *specific tree* satisfies a set of requirements, made
in a way a third party can check. A markdown file committed alongside that tree cannot
make that claim about itself: nothing forces it to be true, nothing binds it to a commit
that exists remotely, and anyone can edit it.

The previous version of this repository had exactly that failure. Committed gate files
claimed `60/60` tests when 22 ran, `certification/reports/e2e.json` said `PASS` for a
placeholder suite, all five benchmarks hardcoded `status: 'PASS'`, two supply-chain
scripts printed `(simulated) - PASS`, and every artifact was bound to commit
`98f914b…` which the certification never actually described. The numbers were not wrong
by accident; there was no mechanism that could have made them right.

What replaces it:

| Requirement | Mechanism |
| --- | --- |
| Numbers come from real runs | `scripts/certification/run-certification.js` executes lint, typecheck, build, every vitest suite, the benchmarks, the policy checks and G16, then parses the raw reporter JSON |
| Generated only in CI | `certification.yml` is the only producer; it resolves the commit from `$GITHUB_SHA` and refuses to run if `HEAD != $GITHUB_SHA` |
| Bound to one commit | Every artifact carries `commit` + `commitSource`; `assert-binding.js` and G16's `evidence-bound` fail on any mismatch |
| Independently checked | `verify-remote-binding` downloads the artifacts and judges them **without the ability to regenerate them** |
| Reproducible across machines | `fingerprint-reproducibility` recomputes the genome on a separate runner and requires an identical fingerprint |
| Failures cannot hide | No `|| echo`, no `|| true`, no job-level `continue-on-error` outside an explicit allow-list; G10 fails the certification if any workflow hides a failure |

---

## 2. Local snapshot

The numbers below come from one run of the orchestrator on a developer machine. Every
artifact from that run carries `"ci": false` and `"commitSource": "argument"`, which is
how you can tell a snapshot from a certification.

| Property | Value |
| --- | --- |
| Commit | `d3903d5414a48dcfabb9e082efb4dd1ac242ee97` |
| Ran in CI | **no** |
| Fingerprint | `82e8952d2095a86ca7152013ff9ddc5f6ad25e44f3b57e34f6dbcae43824cd8b` |
| Identity id | `agi-82e8952d2095a86c` |
| Manifest hash | `3adab84f79fe755387b105eaec750a8d5ba1f54d8a031a91e603b2069a1745b1` |
| Merkle root | `cb7f948c05e72a519c46f837e7d6e81b86dfd1a42c575864d26f33fe3fa88529` |
| Merkle depth | 9 |
| Genome leaves | 328 files / 899,365 bytes |
| Excluded | 34 files, 36 pruned directories |
| Lineage entries | 7 (append-only, tip = this fingerprint) |

> **This fingerprint will not be the certified one.** The fingerprint is a hash of the
> source tree, so the commit that carries these changes has a different tree than the one
> above and therefore a different fingerprint. That is correct behaviour, not a defect —
> and it is why the certified fingerprint must be read from the CI artifact for the
> commit you actually care about, never from a document.

### Genomes

| Domain | Contents | Digest |
| --- | --- | --- |
| System | 26 packages, 12 workflows, config + test surfaces | `ecbb7610…` |
| Core | 3 allow-listed packages | `d9b68d57…` |
| Agent | 12 allow-listed packages | `41b21f70…` |
| Runtime | 10 allow-listed packages | `6c7f178b…` |

---

## 3. Gates

17 gates. **11 blocking, all PASS.** 2 non-blocking PARTIAL, reported exactly as
measured and never upgraded.

| Gate | What it covers | Status | Evidence | Blocking |
| --- | --- | --- | --- | --- |
| G0 | lint, typecheck, build | PASS | 3/3 | yes |
| G1 | unit tests | PASS | 168/168 | yes |
| G2 | integration | PASS | 1/1 | yes |
| G3 | security tests | PASS | 2/2 | yes |
| G4 | contract | PASS | 1/1 | yes |
| G5 | E2E | **PARTIAL** | no pass count (1 file(s)) | no |
| G6 | stress | PASS | 1/1 | yes |
| G7 | chaos | PASS | 1/1 | yes |
| G8 | benchmarks | **PARTIAL** | 3/5 | no |
| G9 | acceptance | PASS | 1/1 | no |
| G10 | governance + supply chain | PASS | 4/4 | yes |
| G11 | documentation | PASS | 9/9 | no |
| G12 | release readiness | PASS | 6/6 checks | no |
| G13 | long-horizon evaluation | PASS | 1/1 | no |
| G14 | safety evaluation | PASS | 4/4 | yes |
| G15 | kernel invariants | PASS | 21/21 | yes |
| G16 | genetic identity | PASS | 18/18 checks | yes |

G10 covers `policy-check --strict`, `workflow-protection-check --strict`,
`license-check` and `verify-provenance --scope=release`.

### G16 — Genetic Identity Gate, 18 checks

The count is read from the artifact, never written by hand. All 18 passed.

```
fingerprint-valid       manifest-hash-valid     lineage-valid           no-secret-material
commit-bound            capability-bound        evidence-bound          package-bound
policy-bound            test-bound              files-bound             parent-bound
merkle-valid            fingerprint-recomputable core-genome-valid      agent-genome-valid
system-genome-valid     circular-free
```

### Secret scan

328 files scanned against 13 rules. **3 findings, all 3 explained by the reviewed
allow-list, 0 unexplained, 0 `.env` leaves, 0 `certification/` leaves.**

The allow-list holds three entries: two ephemeral CI/local Postgres service credentials
and one negative test fixture that exists so the kernel's `noSecretLeak` invariant can be
asserted to *reject* it. Entries must match on the exact `(path, ruleId, redactedExcerpt)`
triple, and an entry that stops matching anything is itself a finding — that is how the
now-deleted `.github/workflows/e2e.yml` exemption was caught.

Test fixtures elsewhere build credential-shaped strings by concatenation at runtime, so
the committed tree holds no secret-shaped text and the allow-list stays about real
exemptions.

### Dependency audit

`npm audit --omit=dev --audit-level=high` → **0 vulnerabilities**.

The full audit reports 5 advisories (3 moderate, 1 high, 1 critical), all in
devDependencies. `security.yml` therefore splits the gate: production is **blocking**,
dev-only is captured as evidence with the advisory detail printed. Making the full audit
blocking would have meant either shipping with a red build or suppressing it — and a
suppressed security gate is worse than a narrow one.

---

## 4. Benchmarks

| Benchmark | Status | Measured |
| --- | --- | --- |
| latency | PASS | p50 **17.97 ms**, p95 **25.54 ms**, p99 **46.13 ms**, mean 19.06 ms, range 13.92–46.13 ms |
| memory | PASS | heapUsed **10.47 MB**, heapTotal 13.79 MB, RSS 91.97 MB, heap delta 5.98 MB |
| planning | PASS | mean **22.12 ms**, p95 40.62 ms, min 14.97 ms, max 40.62 ms |
| tool-use | **NOT_MEASURED** | — |
| long-horizon | **NOT_MEASURED** | — |

`NOT_MEASURED` is not a failure and not a zero. It means no harness exists, so no number
is reported.

- **tool-use** — real throughput requires invoking tools through a live model and
  sandbox, which needs credentials and a non-zero spend budget. This repository enforces
  `MAX_SPEND=0`.
- **long-horizon** — requires a multi-hour autonomous run against a live environment.

All five previously hardcoded `status: 'PASS'` with fabricated numbers. The three that
now report numbers measure real work; the two that cannot, say so.

---

## 5. What is explicitly NOT certified

This is the part that matters most. A certification that does not state its limits is
indistinguishable from an overclaim.

### E2E is PARTIAL, not PASS

`tests/e2e/mission.e2e.test.ts` is a placeholder. It starts no API server and its only
assertion is a tautology. The pipeline detects this **structurally** — it parses the file
and checks whether the assertion can fail — and reports `PARTIAL`:

```json
{
  "path": "tests/e2e/mission.e2e.test.ts",
  "tautological": true,
  "markedPlaceholder": true,
  "markedFixme": true,
  "selfDeclaredPartial": true
}
```

`e2e.yml` then *refuses to publish a PASS*: if the reported status is `PASS` while the
suite is still a placeholder, the job fails. It used to do the opposite —
`|| echo '{"status":"PASS","note":"e2e placeholder"}' > certification/reports/e2e.json`
fabricated a passing artifact precisely when the suite failed to run.

**No browser-level behaviour has been exercised.** Nothing here certifies that the system
works end to end.

### No provider was contacted

The provider layer implements Ollama, NVIDIA, Gemini, Groq and Hugging Face with
local-first resolution and `MAX_SPEND=0`. All of it is **mock-only**. Live status for
every provider is `UNKNOWN` — not `PASS`, not `FAIL`, not `available`. `UNKNOWN` is a
first-class value in this codebase: `unknownSignal()` exists in `@agi-system/autonomy`
for the same reason, and a report whose status is `UNKNOWN` blocks promotion rather than
being treated as healthy.

No secret appears in the genome, and none is required to run anything here.

### Autonomy is tested, not deployed

`@agi-system/autonomy` specifies the supervised loop — health checks, checkpoints,
rollback, an escalating self-healing ladder that always terminates at `ESCALATE_HUMAN`,
and promotion gated on evidence with `MAX_SPEND=0` and no-secrets as *demoting* gates. It
is unit-tested. **No live supervised loop runs anywhere**, and no promotion decision
recorded here reflects a production system.

### Not measured at all

Anything requiring credentials, spend, a live model, a browser, or wall-clock hours:
tool-use throughput, long-horizon autonomy, real E2E flows, live provider availability,
release-level provenance (no GitHub release exists yet, so `verify-provenance` reports
`NOT_VERIFIED` rather than passing).

---

## 6. The closure requirement

```
Remote HEAD == certified commit == manifest binding == evidence binding == recomputed genome binding
```

`closure-statement.js` evaluates each link and prints a per-link verdict. A broken link
is printed as broken and the script exits non-zero. In the local snapshot all eight links
equal `fa7b07f…`; in CI they must equal `$GITHUB_SHA`.

The commit is **never an input to the fingerprint**. It lives only in the non-hashed
`binding` envelope. If it were hashed, generating the record would change the record.
Three independent mechanisms enforce this:

1. `FORBIDDEN_HASHED_KEYS` lists `commit`, `generatedAt`, `timestamp`, `durationMs`;
   `sealManifest()` strips them from hashed material.
2. G16's `circular-free` check asserts no forbidden key is hashed, that the fingerprint
   is identical under two different commit arguments, and that `certification/` is
   excluded from the leaves.
3. `certification.yml` proves it empirically: it computes the fingerprint under
   `--commit=aaa…` and `--commit=bbb…` and requires both to equal the unbound value, then
   writes junk into `certification/gates/`, `certification/reports/` and
   `certification/identity/` and requires the fingerprint not to move.

Commit binding is metadata validation. It answers *which tree is this record about*; the
fingerprint answers *what is this tree*.

---

## 7. Reproducing

```bash
npm ci
npm run certify                                     # full pipeline, writes every artifact
npm run verify         -- --commit=$(git rev-parse HEAD) --require-commit-binding
npm run verify:identity -- --commit=$(git rev-parse HEAD) --require-commit-binding
npm run verify:binding  -- --commit=$(git rev-parse HEAD)
npm run verify:secrets
```

Or the sequence the specification asks for:

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:security
npm run eval
npm run verify
node scripts/identity/verify-genetic-fingerprint.js
```

**Order matters, and this is worth stating plainly.** On a fresh clone the committed
snapshot describes whatever commit it was generated at, which is almost never the commit
you have checked out. Running the two verification commands above *without* first running
`npm run certify` therefore fails — G16 reports the stored fingerprint, the stored Merkle
root and the stored commit binding as stale, because they are.

That is the binding requirement doing its job, not a bug. It is also the clearest
demonstration of why certification is generated in CI: locally you can always regenerate,
so a stale record is an inconvenience; in CI the record is produced from `$GITHUB_SHA` and
there is no stale copy to mistake for it.

```bash
npm run certify && npm run verify && node scripts/identity/verify-genetic-fingerprint.js
```

To cite a certification rather than a snapshot, open the *Certification* workflow run for
the commit in question, download the `certification` artifact, and read
`manifests/latest.json` — checking that `"ci": true` and that `commit` equals the remote
HEAD you are looking at.

---

## 8. Defects found and fixed while building this

Recorded because each one was a way the old pipeline could report success while
verifying nothing.

| Defect | Fix |
| --- | --- |
| Gate files claimed 60/60 tests; 22 ran | Numbers now parsed from raw vitest reporter JSON |
| `reports/e2e.json` said `PASS` for a placeholder | Structural placeholder detection → `PARTIAL`; `e2e.yml` fails if it ever reports `PASS` |
| All 5 benchmarks hardcoded `status: 'PASS'` | 3 measure real work, 2 report `NOT_MEASURED` with the reason |
| `license-check.js` printed `(simulated) - PASS` | Reads 160 installed package manifests and reports the license distribution |
| `verify-provenance.js` printed `(simulated) - PASS` | Checks real attestation records; reports `NOT_VERIFIED` when no release exists |
| `verify-safety.js` passed vacuously on real vitest JSON | Understands both report shapes; fails on a missing, unparsable or empty report |
| `attestation/verify.js` printed a simulated PASS | Real SBOM and record checks, binding enforcement, real exit codes |
| 50 hidden-failure sites across 11 workflows | 65 changes; `|| echo` and `|| true` removed from every verification, build, test and policy step |
| `verify-attestation` verified **before** generating, with `continue-on-error` | Reordered: generate, then verify blocking. A check that runs before its subject cannot fail, so it cannot verify |
| `forkSecretLeak()` referenced an undefined variable | It threw `ReferenceError` on every run — the fork-secret-isolation check was dead code that reported nothing. Fixed and proven live by injecting a leak |
| G16 ran before the gate artifacts were written | Its `evidence-bound` check judged the *previous* run's files. Artifacts are now emitted before G16 |
| `no-secret-material` asserted "certification/ excluded" from a hardcoded string | The count is computed and asserted; a certification leaf in the genome now fails the gate |
| Stale allow-list entry for a removed Postgres service | `findStaleAllowlistEntries()` reports it as a finding |
| Node 20 runners cannot execute `.ts` natively | All 26 `node-version: 20` → `22`; `certification.yml` asserts ≥ 22.6 before running |
| 7 workflows declared no `permissions` | Added; all 12 now declare least privilege |
| Artifacts bound to unreachable `98f914b…` | 12 stale attestation files deleted; everything regenerated and bound to the resolved commit |
| `npm run test:stress` passed `--runInBand`, a Jest-only flag | vitest rejects unknown options with a hard `CACError`, so the script had **never run**. Replaced with `--no-file-parallelism`. No workflow called it, which is why it survived |
| `deploy.yml` smoke test passed `--env staging` to vitest | `--env` selects a vitest environment (node/jsdom), not a deployment target; the step failed outright. The target is now an env var. `deploy.yml` only triggers on `main` and tags, so no branch run ever hit it |
| `governance.yml` ran `node` with no `setup-node` | Behaviour depended on the runner's pre-installed Node; the scripts import TypeScript and need ≥ 22.6. Pinned |
| `governance.yml` "no secrets detected" was one grep for `sk-` in three directories | It could not see a Google API key, GitHub token, AWS key, PEM block, JWT or connection string, and ignored `.github/`, `scripts/`, `tests/`, `benchmarks/`, `evaluations/`. Replaced with the real 13-rule scanner |
| The ADR check ran `ls docs/adr/*.md \| wc -l` and asserted nothing | It detected an architectural change and then printed a count. It could not fail. It now requires an ADR change in the same diff, and reports `NOT_VERIFIED` when the base ref is unresolvable |
| **Determinism leak**: any directory not named in the exclusion list entered the genome | Creating `.fingerprint-out/` and recomputing produced a *different* fingerprint, so the cross-runner reproducibility check compared two different trees and could fail for a reason unrelated to determinism. Hidden directories are now scratch by default (`.github` allow-listed, because workflows are source), dot-FILES like `.gitignore` stay leaves, and a plainly named new directory still counts as source. The leak was worth 71 KB of hashed scratch |
| `evidence-bound` counted attestation records for **previous** commits as mismatches | Per-commit records are named `<sha>.json` and accumulate, so the gate could never pass once more than one certification had been produced. Records naming a different commit are now scoped out - they are evidence for a *different* certification - and the exclusion is counted and reported rather than silent |
| This document's numbers were hand-written | `render-final-report.js` derives all 37 of them from the artifacts, and `--check` fails when the prose disagrees. A hand-written certification document drifts and then quietly starts lying |
| `no-secret-material`'s PASS text asserted "certification/ excluded from leaves" from a hardcoded string | The count is now computed and asserted; a certification leaf in the genome fails the gate |
