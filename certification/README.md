# `certification/`

Output directory for the certification pipeline. **Read this before trusting any number
in here.**

---

## The committed copy is a snapshot. CI is the certification.

Nothing in this directory is authoritative as committed. Every file here was produced by
`scripts/certification/run-certification.js`, and each one records the commit it
describes plus where that commit came from:

```jsonc
{
  "commit": "fa7b07febf86eaca46ff06e7b363e12f405be395",
  "commitSource": "argument",   // or GITHUB_SHA, git-rev-parse, unbound
  "ci": false,                  // true only when produced inside GitHub Actions
  "generatedAt": "..."
}
```

A file with `"ci": false` was generated on a developer machine. It is a record that the
pipeline ran and what it measured at that moment — it is **not** a public certification,
because nothing external attests that the tree it describes is the tree that reached the
remote.

The authoritative record is the **`certification` artifact** attached to the
*Certification — Genetic Identity / Gates / Commit Binding* workflow run for the commit
you care about. Find it at:

```
https://github.com/<owner>/<repo>/actions/workflows/certification.yml
```

That run does three things a local run cannot:

1. It resolves the commit from `$GITHUB_SHA`, so the binding cannot be chosen by whoever
   ran it.
2. It fails if the checked-out HEAD does not equal `$GITHUB_SHA`.
3. A second job (`verify-remote-binding`) downloads the artifacts and re-checks the
   binding **without the ability to regenerate them**. It can only judge what the first
   job produced, which is what makes it an independent check rather than a restatement.

A third job (`fingerprint-reproducibility`) regenerates the genome on a **separate
runner** and requires an identical fingerprint. Recomputing twice in one process proves
the function is pure; recomputing on a different machine proves the genome does not
depend on anything local to the machine that built it.

---

## Layout

| Path | Contents |
| --- | --- |
| `gates/G0.json` … `G16.json` | One file per gate: status, real test counts, reason, commit binding |
| `identity/genetic-manifest.json` | Hashed manifest + non-hashed `binding` envelope |
| `identity/genome.json` | System / Core / Agent / Runtime genomes, Merkle root, exclusions |
| `identity/lineage.json` | Append-only fingerprint history |
| `manifests/latest.json`, `release.json` | Roll-up: every gate, the fingerprint, the counts |
| `attestations/<sha>.json` | Attestation record for one commit |
| `reports/*.json` | Per-suite reports derived from real vitest JSON |
| `reports/raw/*.vitest.json` | **Unmodified** vitest reporter output — the primary evidence |
| `reports/FINAL-CERTIFICATION.md` | Human-readable statement of what is and is not certified |
| `benchmarks/*.json` | Measured benchmark results, including honest `NOT_MEASURED` |
| `sbom/` | Software bill of materials |

`reports/raw/` and `sbom/` are deliberately **not** commit-bound: they are inputs to the
gates, not claims made by them. `assert-binding.js` skips them and says so.

---

## Statuses are what they say

| Status | Meaning |
| --- | --- |
| `PASS` | Measured, and the measurement met the requirement |
| `PARTIAL` | Measured, and the measurement did **not** meet the full requirement |
| `FAIL` | Measured, and it did not meet the requirement |
| `NOT_CERTIFIED` | Not measured. No number is reported because none exists |
| `NOT_MEASURED` | Benchmark-level equivalent of `NOT_CERTIFIED` |

`PARTIAL` and `NOT_CERTIFIED` are never upgraded to `PASS`. Two gates are currently
`PARTIAL` and both are non-blocking for a stated reason:

- **G5 (E2E)** — `tests/e2e/mission.e2e.test.ts` is a placeholder. It starts no server
  and its only assertion is a tautology. The pipeline detects this *structurally* and
  reports `PARTIAL`. It used to be reported as `PASS` by a workflow step that wrote
  `|| echo '{"status":"PASS"}' > certification/reports/e2e.json`, which fabricated a
  passing artifact whenever the suite failed to run.
- **G8 (Benchmarks)** — 3 of 5 benchmarks are measured. `tool-use` and `long-horizon`
  report `NOT_MEASURED` because no harness exists for them yet. All five previously
  hardcoded `status: 'PASS'`.

---

## Reproducing locally

```bash
npm ci
npm run certify                  # runs everything, writes all artifacts
npm run verify -- --commit=$(git rev-parse HEAD) --require-commit-binding
npm run verify:identity -- --commit=$(git rev-parse HEAD) --require-commit-binding
npm run verify:binding -- --commit=$(git rev-parse HEAD)
```

Or go straight to the orchestrator with an explicit binding requirement:

```bash
node scripts/certification/run-certification.js --commit=$(git rev-parse HEAD) --require-binding
```

A local run will report `ci: false` and `commitSource: argument`. That is correct and
expected — it is why the CI artifact, not this directory, is the thing to cite.

---

## What this pipeline refuses to do

- It will not write `PASS` for a suite that did not run.
- It will not accept an artifact bound to a different commit than the one being
  certified. In CI, a mismatch is a hard failure.
- It will not hash the commit into the fingerprint. Commit binding is metadata
  validation, not identity input; `circular-free` is one of G16's 18 checks and
  `certification.yml` proves it empirically by computing the fingerprint under two
  different commit arguments.
- It will not report a placeholder E2E suite as full E2E coverage.
- It will not print `(simulated) - PASS`. `license-check.js` and `verify-provenance.js`
  both used to. They now read the installed dependency tree and the attestation records
  respectively.
- It will not tolerate `|| echo`, `|| true` or `continue-on-error: true` outside an
  explicit allow-list of third-party infrastructure steps that certify nothing. G10
  fails the certification if any workflow hides a failure.
