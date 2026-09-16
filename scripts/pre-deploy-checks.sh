#!/usr/bin/env bash
#
# pre-deploy-checks.sh - gate that must pass BEFORE deploying to Fly.io.
#
# Every check is a real assertion that can FAIL. Exit code is non-zero if any
# required check fails, so this is safe to wire into CI or a deploy script.
#
# Usage:
#   ./scripts/pre-deploy-checks.sh            # full gate
#   SKIP_FLY=1 ./scripts/pre-deploy-checks.sh # skip checks needing flyctl/network
#
set -uo pipefail
cd "$(dirname "$0")/.."

APP="${FLY_APP:-celiaos}"
VOLUME="${FLY_VOLUME:-celiaos_data}"
MOUNT="${FLY_MOUNT:-/app/certification}"
SKIP_FLY="${SKIP_FLY:-0}"

PASS=0; FAIL=0; SKIP=0
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
skip() { echo "  SKIP  $1"; SKIP=$((SKIP+1)); }
hdr()  { echo; echo "[$1] $2"; }

echo "=============================================="
echo " Pre-deploy gate - app=$APP volume=$VOLUME"
echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="

# --- 1. Git state -----------------------------------------------------------
hdr 1 "Git working tree"
if [ -z "$(git status --porcelain)" ]; then
  ok "working tree clean"
else
  bad "uncommitted changes present (commit or stash before deploying):"
  git status --short | sed 's/^/        /'
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "        branch: $BRANCH"
echo "        commit: $(git rev-parse --short HEAD)"

# --- 2. Local vs remote -----------------------------------------------------
# Queries the remote directly: this clone's fetch refspec may only track main,
# so a missing origin/<branch> ref does not mean the branch was never pushed.
# This is the check that would have caught the previous session losing its work.
hdr 2 "Commits pushed to remote"
REMOTE_SHA=$(git ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | awk '{print $1}')
LOCAL_SHA=$(git rev-parse HEAD)
if [ -z "$REMOTE_SHA" ]; then
  bad "branch $BRANCH does not exist on origin - run: git push -u origin $BRANCH"
  echo "        unpushed work is lost when the sandbox is discarded"
elif [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  ok "remote is up to date ($(git rev-parse --short HEAD))"
else
  if git merge-base --is-ancestor "$REMOTE_SHA" HEAD 2>/dev/null; then
    AHEAD=$(git rev-list --count "$REMOTE_SHA..HEAD")
    bad "$AHEAD local commit(s) not pushed - run: git push origin $BRANCH"
    git log --oneline "$REMOTE_SHA..HEAD" | sed 's/^/        /'
  else
    bad "local and remote have diverged - reconcile before deploying"
    echo "        local=$(git rev-parse --short HEAD) remote=${REMOTE_SHA:0:7}"
  fi
fi

# --- 3. Build + typecheck ---------------------------------------------------
hdr 3 "TypeScript compiles"
if [ -x ./node_modules/.bin/tsc ]; then
  if ./node_modules/.bin/tsc --noEmit -p services/api-server/tsconfig.json >/tmp/tsc.log 2>&1; then
    ok "api-server typechecks"
  else
    bad "api-server typecheck failed:"; sed 's/^/        /' /tmp/tsc.log | head -20
  fi
else
  bad "typescript not installed - run npm ci"
fi

# --- 4. Persistence wiring (the Gap #2 regression guard) --------------------
hdr 4 "Persistence is wired to PERSISTENCE_PATH"
if grep -q 'PERSISTENCE_PATH' services/api-server/src/index.ts; then
  ok "api-server reads PERSISTENCE_PATH"
else
  bad "api-server does NOT read PERSISTENCE_PATH - state will be lost on restart"
fi
for pkg in memory-fabric mission-ledger; do
  if grep -q 'process.env.PERSISTENCE_PATH' "packages/$pkg/src/index.ts" 2>/dev/null; then
    ok "$pkg honours PERSISTENCE_PATH"
  else
    bad "$pkg ignores PERSISTENCE_PATH - writes would land outside the volume"
  fi
done
# The regression that caused Gap #2: mutations that never hit disk.
if grep -q 'function persistAll' services/api-server/src/index.ts; then
  ok "api-server has disk flush helpers"
else
  bad "api-server has no persistence helpers - Map-only storage"
fi

# --- 5. Restart-durability proof (actually runs the server) -----------------
hdr 5 "Restart durability (live test)"
if command -v node >/dev/null 2>&1; then
  if ./scripts/test-persistence-restart.sh >/tmp/restart.log 2>&1; then
    ok "state survives SIGKILL + restart"
    grep -E 'Loaded persistence' /tmp/restart.log | head -1 | sed 's/^/        /'
  else
    bad "restart durability test FAILED:"; tail -20 /tmp/restart.log | sed 's/^/        /'
  fi
else
  bad "node not available"
fi

# --- 6. fly.toml / Dockerfile config ---------------------------------------
hdr 6 "Fly.io config declares the volume"
if grep -q '^\[mounts\]' fly.toml; then
  ok "fly.toml has [mounts]"
  grep -A3 '^\[mounts\]' fly.toml | sed 's/^/        /'
  grep -q "source *= *\"$VOLUME\"" fly.toml \
    && ok "mount source = $VOLUME" || bad "mount source != $VOLUME"
  grep -q "destination *= *\"$MOUNT\"" fly.toml \
    && ok "mount destination = $MOUNT" || bad "mount destination != $MOUNT"
else
  bad "fly.toml missing [mounts] - volume will not be attached, data lost on restart"
fi
grep -q "PERSISTENCE_PATH" fly.toml \
  && ok "fly.toml sets PERSISTENCE_PATH" || bad "fly.toml does not set PERSISTENCE_PATH"
grep -q "PERSISTENCE_PATH" Dockerfile \
  && ok "Dockerfile sets PERSISTENCE_PATH" || bad "Dockerfile does not set PERSISTENCE_PATH"

# Mount destination must match the env var, or writes miss the volume entirely.
FLY_PP=$(grep -oP 'PERSISTENCE_PATH\s*=\s*"\K[^"]+' fly.toml | head -1)
if [ "${FLY_PP:-}" = "$MOUNT" ]; then
  ok "PERSISTENCE_PATH ($FLY_PP) == mount destination ($MOUNT)"
else
  bad "PERSISTENCE_PATH ($FLY_PP) != mount destination ($MOUNT) - writes would miss the volume"
fi

# --- 7. Health check present ------------------------------------------------
hdr 7 "Container healthcheck"
grep -q 'HEALTHCHECK' Dockerfile \
  && ok "Dockerfile HEALTHCHECK defined" || bad "no HEALTHCHECK - Fly cannot detect a wedged machine"

# --- 8. flyctl auth + remote volume (network required) ----------------------
hdr 8 "flyctl auth and remote volume"
if [ "$SKIP_FLY" = "1" ]; then
  skip "SKIP_FLY=1 set"
elif ! command -v flyctl >/dev/null 2>&1 && ! command -v fly >/dev/null 2>&1; then
  bad "flyctl not installed - run: curl -L https://fly.io/install.sh | sh"
else
  FLYBIN=$(command -v flyctl || command -v fly)
  if $FLYBIN auth whoami >/tmp/fly-auth.log 2>&1; then
    ok "authenticated as $(cat /tmp/fly-auth.log)"
    if $FLYBIN volumes list -a "$APP" 2>/dev/null | grep -q "$VOLUME"; then
      ok "volume $VOLUME exists on app $APP"
      $FLYBIN volumes list -a "$APP" | sed 's/^/        /'
    else
      bad "volume $VOLUME NOT found - create: $FLYBIN volumes create $VOLUME -a $APP -r <region> -s 3"
    fi
  else
    bad "flyctl not authenticated - run: $FLYBIN auth login"
  fi
fi

# --- summary ----------------------------------------------------------------
echo
echo "=============================================="
echo " PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
if [ "$FAIL" -eq 0 ]; then
  echo " GATE: PASS - safe to deploy"
  echo "=============================================="
  exit 0
else
  echo " GATE: FAIL - fix the above before deploying"
  echo "=============================================="
  exit 1
fi
