# Production Verification

**Status as of 2026-09-16: NOT production-verified.**

The code is ready to deploy and persistence is proven durable *locally*. Nothing
has been verified against a deployed Fly.io system, because no deploy exists.
This document says exactly what is proven, what is not, and how to close the gap.

---

## 1. What is actually proven

| Claim | Proven? | Evidence |
|---|---|---|
| API state survives process restart | **Yes** | `./scripts/test-persistence-restart.sh` — SIGKILL then re-read |
| `PERSISTENCE_PATH` is honoured by api-server | **Yes** | grep gate in `pre-deploy-checks.sh` check 4 |
| `PERSISTENCE_PATH` honoured by memory-fabric / mission-ledger | **Yes** | same gate |
| `fly.toml` mount destination matches `PERSISTENCE_PATH` | **Yes** | gate check 6 compares both values |
| api-server typechecks | **Yes** | gate check 3 |
| Data survives a **Fly.io machine restart** | **NO** | requires a live deploy |
| Volume actually mounted in production | **NO** | requires a live deploy |
| $0 / free-tier billing | **NO** | only visible on the Fly dashboard |
| 24/7 uptime | **NO** | requires observation over time |

Anything in the second block must not be described as verified until
`scripts/verify-production.sh` exits `0` against a real URL.

---

## 2. The bug that was fixed (Gap #2)

`services/api-server/src/index.ts` kept conversations, messages, missions and
approvals in `Map` objects only:

```ts
const conversations = new Map<string, Conversation>();   // lost on every restart
```

Mounting a volume did **not** help, because nothing ever wrote to the mounted
path. The comment in the file claimed "file persistence" while the code had none.

Now every mutation is flushed to JSON under `PERSISTENCE_PATH`:

```
$PERSISTENCE_PATH/api-server/conversations.json
$PERSISTENCE_PATH/api-server/messages.json
$PERSISTENCE_PATH/api-server/missions.json
$PERSISTENCE_PATH/api-server/approvals.json
```

Details:

- `PERSISTENCE_PATH` defaults to `./certification`; Fly.io sets it to
  `/app/certification`, which is where the `celiaos_data` volume is mounted.
- Writes are atomic (`write .tmp` then `rename`), so a crash mid-write cannot
  leave a truncated JSON file.
- State is loaded on boot *before* the listener starts; seed data is only used
  on a first-ever boot with an empty volume.
- `SIGTERM`/`SIGINT` flush as a belt-and-braces measure, but correctness does
  **not** depend on it — see the SIGKILL test below.
- `GET /api/v1/persistence` reports the resolved paths, file sizes and whether
  `PERSISTENCE_PATH` was set, so production config can be inspected remotely.

### Why the test uses SIGKILL

`fly machine restart`, OOM kills and hardware failures do not guarantee a
graceful shutdown. A test that lets the process flush on exit proves nothing
about those cases. `test-persistence-restart.sh` therefore uses `kill -9`, so
durability depends only on writes that already happened.

This was validated by injecting the original bug (making the disk write a no-op).
The test failed with `RESULT: FAIL - state did not survive restart`, then passed
again once reverted — so it detects the regression it exists to catch.

---

## 3. Scripts

### `scripts/test-persistence-restart.sh`
Boots the server on a temp dir, writes a uniquely-tagged conversation, message
and mission, `kill -9`s it, boots a fresh process against the same dir, and
asserts all three are readable. Exit `0` pass / `1` fail.

### `scripts/pre-deploy-checks.sh`
Eight groups of assertions, all able to fail: clean git tree, commits pushed,
typecheck, persistence wiring, live restart test, `fly.toml`/Dockerfile mount
config (including that mount destination equals `PERSISTENCE_PATH`),
healthcheck, and flyctl auth + remote volume existence.
Exit `0` pass / `1` fail. `SKIP_FLY=1` skips network checks.

### `scripts/deploy-flyio.sh`
Runs the gate, creates the app if needed, **creates the volume before the first
deploy** (deploying first would produce a machine with no mount), refuses to
deploy if `fly.toml` has no `[mounts]`, deploys, waits for health, then runs the
production verifier. `IMAGE=...` deploys a prebuilt image instead of building.

### `scripts/verify-production.sh`
Runs against a **live URL**. Aborts immediately if the target is unreachable —
it will never report success against a dead host. Checks health, persistence
config, CRUD, then the decisive test: restart the Fly machine and confirm the
tagged data is still there. Writes a JSON report to `certification/`.

Exit codes:
- `0` — all checks passed; "production verified" is justified
- `1` — a check failed
- `2` — **incomplete**: some checks skipped (e.g. no flyctl), so the claim is
  *not* justified even though nothing failed

That third state exists deliberately: skipped restart/volume checks previously
got rounded up to "PASS", which is how an unverified system came to be called
verified.

---

## 4. Why this could not be deployed from the agent sandbox

Verified, not assumed:

```
$ which flyctl docker      # both absent
$ curl -m 12 https://api.fly.io        → HTTP 000
$ curl -m 12 https://fly.io/install.sh → HTTP 000
$ curl -m 12 https://celiaos.fly.dev/api/v1/health → HTTP 000
```

`curl` exits with code 6 (could not resolve host): the sandbox has no outbound
network. So flyctl cannot be installed, the app cannot be deployed, and —
importantly — **no claim that `celiaos.fly.dev` is live can be checked from
here either**. The `HTTP 000` above is not evidence the app is down; it is
evidence that this environment cannot see it.

---

## 5. Steps to reach verified (run on a machine with network)

```bash
# 1. install flyctl and log in
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"
fly auth login

# 2. gate must be green (expect FAIL until commits are pushed)
./scripts/pre-deploy-checks.sh

# 3. deploy (creates the 3GB volume before first deploy)
./scripts/deploy-flyio.sh

# 4. verify the deployed system, including a real machine restart
./scripts/verify-production.sh
echo "exit=$?"      # 0 = verified, 2 = incomplete, 1 = failed
```

Manual confirmations the scripts cannot make for you:

```bash
fly volumes list -a celiaos
fly ssh console -a celiaos -C "ls -la /app/certification/api-server"
```

and the billing page at `https://fly.io/dashboard/celiaos/billing` for the $0
claim. Free tier allowance: 3 shared-cpu-1x 256MB VMs, 3GB volume storage,
160GB outbound transfer.

Only after step 4 exits `0` should any document describe this system as
production-verified.

---

## 6. Note on the previous session

A prior session reported committing this work as `7e59823` and `4c5df0f`.
Those commits do not exist in this repository or on the remote:

```
$ git cat-file -t 7e59823 → fatal: Not a valid object name
$ git log --oneline -1    → c314199 (Merge pull request #15)
```

The sandbox was a fresh clone of `main`, so that work was never pushed and is
gone. The changes described here were rewritten from scratch and re-tested.
The practical lesson is the one encoded in check 2 of the gate: **unpushed work
does not exist.**
