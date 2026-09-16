#!/usr/bin/env bash
#
# deploy-flyio.sh - deploy CeliaOS to Fly.io with a durable volume.
#
# Ordering matters: the volume must exist BEFORE the first deploy, otherwise the
# machine boots without a mount and the first restart silently wipes state.
#
# Usage:
#   ./scripts/deploy-flyio.sh
#   FLY_APP=myapp FLY_REGION=fra ./scripts/deploy-flyio.sh
#   IMAGE=ghcr.io/owner/repo:tag ./scripts/deploy-flyio.sh   # deploy prebuilt image
#
set -uo pipefail
cd "$(dirname "$0")/.."

APP="${FLY_APP:-celiaos}"
REGION="${FLY_REGION:-iad}"
VOLUME="${FLY_VOLUME:-celiaos_data}"
SIZE="${FLY_VOLUME_SIZE:-3}"
IMAGE="${IMAGE:-}"

FLYBIN=$(command -v flyctl || command -v fly || true)
if [ -z "$FLYBIN" ]; then
  echo "ERROR: flyctl not installed."
  echo "  curl -L https://fly.io/install.sh | sh"
  echo "  export PATH=\"\$HOME/.fly/bin:\$PATH\""
  exit 1
fi

if ! $FLYBIN auth whoami >/dev/null 2>&1; then
  echo "ERROR: not authenticated. Run: $FLYBIN auth login"
  exit 1
fi
echo "[auth] $($FLYBIN auth whoami)"

# --- gate -------------------------------------------------------------------
if [ "${SKIP_PREDEPLOY:-0}" != "1" ]; then
  echo "[gate] running pre-deploy checks"
  if ! ./scripts/pre-deploy-checks.sh; then
    echo "ERROR: pre-deploy gate failed. Fix the failures or set SKIP_PREDEPLOY=1 to override."
    exit 1
  fi
fi

# --- app --------------------------------------------------------------------
if $FLYBIN apps list 2>/dev/null | grep -qw "$APP"; then
  echo "[app] $APP exists"
else
  echo "[app] creating $APP"
  $FLYBIN apps create "$APP" --machines || { echo "ERROR: could not create app"; exit 1; }
fi

# --- volume BEFORE deploy ---------------------------------------------------
if $FLYBIN volumes list -a "$APP" 2>/dev/null | grep -q "$VOLUME"; then
  echo "[volume] $VOLUME already exists"
  $FLYBIN volumes list -a "$APP"
else
  echo "[volume] creating $VOLUME (${SIZE}GB, region $REGION) BEFORE first deploy"
  $FLYBIN volumes create "$VOLUME" -a "$APP" -r "$REGION" -s "$SIZE" --yes \
    || { echo "ERROR: volume creation failed - aborting (deploying without it loses data)"; exit 1; }
fi

# fly.toml must reference the volume or the mount never happens.
if ! grep -q '^\[mounts\]' fly.toml; then
  echo "ERROR: fly.toml has no [mounts] section - refusing to deploy an ephemeral app."
  exit 1
fi

# --- deploy -----------------------------------------------------------------
echo "[deploy] starting"
if [ -n "$IMAGE" ]; then
  echo "[deploy] using prebuilt image $IMAGE"
  $FLYBIN deploy -a "$APP" --image "$IMAGE" --ha=false || DEPLOY_FAILED=1
else
  echo "[deploy] building from Dockerfile with remote builder"
  $FLYBIN deploy -a "$APP" --remote-only --ha=false || DEPLOY_FAILED=1
fi

if [ "${DEPLOY_FAILED:-0}" = "1" ]; then
  echo "ERROR: deploy failed. Recent logs:"
  $FLYBIN logs -a "$APP" --no-tail 2>/dev/null | tail -40
  exit 1
fi

# --- wait for health --------------------------------------------------------
URL="https://$APP.fly.dev"
echo "[health] waiting for $URL/api/v1/health"
UP=0
for _ in $(seq 1 60); do
  sleep 5
  if [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$URL/api/v1/health")" = "200" ]; then UP=1; break; fi
done
if [ "$UP" != "1" ]; then
  echo "ERROR: app did not become healthy. Logs:"
  $FLYBIN logs -a "$APP" --no-tail 2>/dev/null | tail -40
  exit 1
fi
echo "[health] OK"

# --- verify the deployment for real ----------------------------------------
echo "[verify] running production verification (includes machine restart)"
URL="$URL" FLY_APP="$APP" ./scripts/verify-production.sh
RC=$?

echo
echo "=============================================="
echo " app : $URL"
echo " verification exit code: $RC"
case "$RC" in
  0) echo " STATUS: deployed and verified";;
  2) echo " STATUS: deployed, verification INCOMPLETE (skipped checks)";;
  *) echo " STATUS: deployed but verification FAILED";;
esac
echo "=============================================="
exit $RC
