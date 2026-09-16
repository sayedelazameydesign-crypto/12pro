# `@agi-system/identity`

Deterministic genetic identity for the repository: a canonical manifest, a SHA-256
fingerprint, a real Merkle root over every source file, four genome domains, and an
append-only lineage. Plus **G16**, the gate that verifies all of it.

This package exists because a certification that describes "the system" without saying
*which* system, reproducibly, is not a certification. Everything here is derived from
file contents, so the same tree always produces the same fingerprint on any machine.

```ts
import { generateGeneticIdentity, runG16Checks, computeFingerprint } from '@agi-system/identity';
```

---

## What it produces

| Artifact | Contents |
| --- | --- |
| `certification/identity/genetic-manifest.json` | The hashed `manifest` plus a **non-hashed** `binding` envelope |
| `certification/identity/genome.json` | System / Core / Agent / Runtime genomes, Merkle root, leaf count, exclusions |
| `certification/identity/lineage.json` | Append-only history: fingerprint → parentFingerprint → commit |
| `certification/gates/G16.json` | The 18-check report |

The identity id is derived, never chosen: `agi-` + the first 16 hex characters of the
fingerprint.

---

## Determinism

The fingerprint is a hash of canonical JSON over the file leaves and the genome domains.
Four rules make it reproducible, and each one is enforced in code rather than by
convention:

1. **Keys are sorted, numbers are normalized, strings are UTF-8.** `canonicalJson()`
   produces byte-identical output for semantically identical input.
2. **Nothing time-varying or machine-varying is hashed.** `FORBIDDEN_HASHED_KEYS`
   lists `commit`, `generatedAt`, `timestamp` and `durationMs`; `sealManifest()` strips
   them from the hashed material and `assertFingerprintIgnoresBinding()` proves the
   fingerprint is unchanged when the commit argument changes.
3. **Counts are diagnostics, not material.** File counts that depend on which
   directories happen to be present (`node_modules`, build output, caches) are recorded
   in the unhashed `binding.diagnostics`, not in the hash.
4. **The genome excludes its own output.** `certification/identity/**` is not a leaf,
   and secrets are never read at all — `NEVER_READ_PATTERNS` and `EXCLUDED_PATH_PREFIXES`
   keep `.env`, private keys and credential files out of the tree before hashing.

### No circular dependency

The commit is *metadata about* the fingerprint, not an *input to* it. It lives only in
`binding.commit`. If it were hashed, generating the record would change the record, and
the whole scheme would be self-referential nonsense. `certification.yml` tests this
directly: it computes the fingerprint under two different `--commit` arguments and
requires the results to be identical, then writes junk into `certification/` and
requires the fingerprint not to move.

---

## Merkle tree

`buildMerkleTree()` hashes each file leaf (`sha256(file bytes)` with its repo-relative
POSIX path), sorts the digests, and folds them pairwise up to a single root.
`inclusionProof()` / `verifyInclusionProof()` produce and check a real audit path, so a
single file's membership can be proved without re-hashing the repository. `leavesUnder()`
and `recomputeRootFromDigests()` let the genome domains re-derive their own digests,
which is what `merkle-valid` and `fingerprint-recomputable` check.

---

## G16 — Genetic Identity Gate, exactly 18 checks

The count is read from the artifact, never written by hand.

| # | Check | What it proves |
| --- | --- | --- |
| 1 | `fingerprint-valid` | The fingerprint is 64 lowercase hex |
| 2 | `manifest-hash-valid` | `manifestHash` recomputes from the manifest material |
| 3 | `lineage-valid` | Every entry chains to its parent; the newest names the current fingerprint |
| 4 | `no-secret-material` | Zero unexplained secret findings and zero stale allow-list entries |
| 5 | `commit-bound` | The binding envelope names a real 40-hex commit |
| 6 | `capability-bound` | Declared capabilities match the packages that implement them |
| 7 | `evidence-bound` | Every gate/report artifact names the same commit |
| 8 | `package-bound` | Workspace packages match what the genome claims |
| 9 | `policy-bound` | The hashed policy snapshot matches the policy files on disk |
| 10 | `test-bound` | Declared test surfaces exist |
| 11 | `files-bound` | Leaf count and total bytes match a fresh scan |
| 12 | `parent-bound` | The lineage parent is the previous fingerprint |
| 13 | `merkle-valid` | The stored root recomputes from the leaves |
| 14 | `fingerprint-recomputable` | A second computation yields the same fingerprint |
| 15 | `core-genome-valid` | Core Genome digest recomputes; allow-listed packages present |
| 16 | `agent-genome-valid` | Agent Genome digest recomputes; allow-listed packages present |
| 17 | `system-genome-valid` | System Genome digest recomputes over packages, workflows, configs, tests |
| 18 | `circular-free` | No forbidden key is hashed; the fingerprint is identical under two commit arguments; `certification/` is excluded from leaves |

Run it directly:

```bash
node scripts/identity/generate-genetic-fingerprint.ts --unbound
node scripts/identity/verify-genetic-fingerprint.js --write-gate
```

`verify-genetic-fingerprint.js` exits non-zero when any check fails. In CI it is invoked
with `--require-commit-binding`, which additionally fails when the binding envelope does
not name `$GITHUB_SHA`.

---

## Secret scanning

`SECRET_RULES` (13 patterns: OpenAI-style keys, Google API keys, GitHub tokens, Hugging
Face and NVIDIA keys, Groq keys, AWS access keys, PEM private key blocks, JWTs,
connection strings with embedded passwords, generic `apiKey`/`bearer` assignments) run
over every non-excluded file. Findings are redacted — `redact()` never returns the raw
value, and the finding object carries only a truncated, masked excerpt.

Because a scanner that cannot be tuned gets disabled, there is a reviewed allow-list in
`secret-allowlist.ts`. Each entry must match on the exact `(path, ruleId,
redactedExcerpt)` triple, so an entry cannot silently blanket-allow a file or a rule, and
each carries a reason, a reviewer and a review date. `findStaleAllowlistEntries()` reports
entries that have stopped matching anything, because a stale exemption quietly
pre-approves a location that may later hold a real secret. That is how the now-deleted
`.github/workflows/e2e.yml` entry was caught.

Test fixtures that need credential-shaped strings build them by concatenation at runtime
(see `tests/unit/identity/secrets.test.ts`) so the committed tree holds no
secret-shaped text and the allow-list stays about real exemptions.

---

## Design notes

- **Zero runtime dependencies.** The package depends on Node's `node:crypto` and
  `node:fs` only, so the thing that fingerprints the system cannot itself drift.
- **`main` points at TypeScript source** (`./src/index.ts`). The monorepo consumes
  packages as source and type-checks them through project references; nothing here is
  pre-compiled.
- **Exclusion decisions are recorded, not silent.** `decideExclusion()` returns a reason
  for every path it skips, and the policy snapshot is hashed so a change to what is
  excluded changes the fingerprint.
