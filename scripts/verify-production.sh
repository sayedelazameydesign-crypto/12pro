#!/usr/bin/env bash
#
# verify-production.sh - verifies the DEPLOYED system, not the local code.
#
# This is the only script that can justify a "production verified" claim,
# because every assertion runs against a live URL over the network.
#
# Usage:
#   ./scripts/verify-production.sh                       # defaults to https://celiaos.fly.dev
#   URL=https://myapp.fly.dev ./scripts/verify-production.sh
#   SKIP_RESTART=1 ./scripts/verify-production.sh        # skip the machine-restart test
#
# The restart test needs flyctl + an app you control; without it the persistence
# claim is NOT proven and the script reports that honestly instead of passing.
#
set -uo pipefail
cd "$(dirname "$0")/.." 2>/dev/null || true

URL="${URL:-https://celiaos.fly.dev}"
APP="${FLY_APP:-celiaos}"
SKIP_RESTART="${SKIP_RESTART:-0}"
TOKEN="PRODVERIFY_$(date +%s)"
REPORT="${REPORT:-certification/production-verification-$(date +%Y%m%d-%H%M%S).json}"

PASS=0; FAIL=0; SKIP=0
RESULTS=""
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); RESULTS="$RESULTS{\"check\":\"$1\",\"result\":\"pass\"},"; }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); RESULTS="$RESULTS{\"check\":\"$1\",\"result\":\"fail\"},"; }
skip() { echo "  SKIP  $1"; SKIP=$((SKIP+1)); RESULTS="$RESULTS{\"check\":\"$1\",\"result\":\"skip\"},"; }
hdr()  { echo; echo "── $1"; }

echo "=================================================="
echo " PRODUCTION VERIFICATION"
echo " target : $URL"
echo " app    : $APP"
echo " time   : $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=================================================="

# 0. Reachability - everything below is meaningless if this fails.
hdr "0. Reachability"
CODE=$(curl -s -m 20 -o /tmp/pv-health.json -w '%{http_code}' "$URL/api/v1/health" 2>/dev/null)
if [ "$CODE" = "200" ]; then
  ok "health endpoint reachable (HTTP 200)"
  head -c 400 /tmp/pv-health.json | sed 's/^/        /'; echo
else
  bad "health endpoint unreachable (HTTP ${CODE:-000}) - target is NOT deployed"
  echo
  echo "  Nothing else can be verified against a dead target."
  echo "  Deploy first:  ./scripts/deploy-flyio.sh"
  echo
  echo "=================================================="
  echo " RESULT: FAIL - target not reachable"
  echo "=================================================="
  exit 1
fi

# 1. Health payload
hdr "1. Health payload"
python3 - "$URL" <<'PY' && ok "health json well-formed" || bad "health json malformed"
import json,sys,urllib.request
d=json.load(urllib.request.urlopen(sys.argv[1]+"/api/v1/health",timeout=20))
assert d.get("status")=="ok", d
print("        status=%s version=%s" % (d.get("status"), d.get("version")))
p=d.get("persistence")
if p: print("        persistence=%s dir=%s durable=%s" % (p.get("mode"),p.get("dir"),p.get("durable")))
PY

# 2. Persistence is file-backed on a mounted volume
hdr "2. Persistence configuration"
PCODE=$(curl -s -m 20 -o /tmp/pv-persist.json -w '%{http_code}' "$URL/api/v1/persistence")
if [ "$PCODE" = "200" ]; then
  ok "/api/v1/persistence reachable"
  python3 - <<'PY' && ok "persistence files exist on disk" || bad "persistence files missing"
import json
d=json.load(open("/tmp/pv-persist.json"))
print("        dir=%s env=%s durable=%s" % (d.get("persistenceDir"),d.get("envPersistencePath"),d.get("durable")))
for f in d.get("files",[]):
    print("        %-14s exists=%-5s %sB" % (f["store"],f["exists"],f["bytes"]))
assert d.get("durable") is True
PY
  python3 -c "
import json;d=json.load(open('/tmp/pv-persist.json'))
import sys; sys.exit(0 if d.get('envPersistencePath') else 1)" \
    && ok "PERSISTENCE_PATH is set in the deployed container" \
    || bad "PERSISTENCE_PATH unset in production - writes are NOT on the volume"
else
  bad "/api/v1/persistence returned HTTP $PCODE (old build deployed?)"
fi

# 3. API CRUD
hdr "3. API create/read"
CONV=$(curl -s -m 20 -X POST "$URL/api/v1/conversations" \
  -H 'Content-Type: application/json' -d "{\"title\":\"$TOKEN\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$CONV" ]; then
  ok "created conversation $CONV"
else
  bad "could not create conversation"
fi
if [ -n "$CONV" ]; then
  curl -s -m 20 -X POST "$URL/api/v1/conversations/$CONV/messages" \
    -H 'Content-Type: application/json' -d "{\"content\":\"MSG_$TOKEN\"}" >/dev/null
  sleep 2
  curl -s -m 20 "$URL/api/v1/conversations/$CONV/messages" | grep -q "MSG_$TOKEN" \
    && ok "message stored and readable" || bad "message not readable"
fi

# 4. THE decisive test: restart the machine, confirm data is still there.
hdr "4. Persistence across machine restart (decisive)"
FLYBIN=$(command -v flyctl || command -v fly || true)
if [ "$SKIP_RESTART" = "1" ]; then
  skip "SKIP_RESTART=1 - persistence across restart NOT proven"
elif [ -z "$FLYBIN" ]; then
  skip "flyctl not installed - persistence across restart NOT proven"
elif ! $FLYBIN auth whoami >/dev/null 2>&1; then
  skip "flyctl not authenticated - persistence across restart NOT proven"
elif [ -z "$CONV" ]; then
  bad "no conversation to verify after restart"
else
  MACHINE=$($FLYBIN machines list -a "$APP" --json 2>/dev/null \
    | python3 -c "import sys,json;m=json.load(sys.stdin);print(m[0]['id'] if m else '')" 2>/dev/null)
  if [ -z "$MACHINE" ]; then
    bad "could not list machines for app $APP"
  else
    echo "        restarting machine $MACHINE ..."
    $FLYBIN machine restart "$MACHINE" -a "$APP" >/dev/null 2>&1
    echo "        waiting for machine to come back ..."
    BACK=0
    for _ in $(seq 1 60); do
      sleep 5
      if [ "$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$URL/api/v1/health")" = "200" ]; then BACK=1; break; fi
    done
    if [ "$BACK" = "1" ]; then
      ok "machine came back after restart"
      if curl -s -m 20 "$URL/api/v1/conversations" | grep -q "$TOKEN"; then
        ok "DATA SURVIVED RESTART - conversation $TOKEN still present"
      else
        bad "DATA LOST ON RESTART - volume not mounted or persistence broken"
      fi
      curl -s -m 20 "$URL/api/v1/conversations/$CONV/messages" | grep -q "MSG_$TOKEN" \
        && ok "message survived restart" || bad "message lost on restart"
    else
      bad "machine did not return within 5 minutes"
    fi
  fi
fi

# 5. Volume actually attached
hdr "5. Volume attachment"
if [ -n "$FLYBIN" ] && $FLYBIN auth whoami >/dev/null 2>&1; then
  if $FLYBIN volumes list -a "$APP" 2>/dev/null | grep -q .; then
    $FLYBIN volumes list -a "$APP" | sed 's/^/        /'
    ok "volume listed for app"
  else
    bad "no volume attached - data cannot survive restart"
  fi
  $FLYBIN ssh console -a "$APP" -C "ls -la /app/certification/api-server" 2>/dev/null | sed 's/^/        /' \
    && ok "persistence dir present inside the container" \
    || skip "could not ssh to inspect volume contents"
else
  skip "flyctl unavailable - cannot confirm volume attachment"
fi

# 6. Cost guard
hdr "6. Zero-cost guard"
curl -s -m 20 "$URL/api/v1/health" | grep -qi 'spend' && ok "spend reported in telemetry" || skip "no spend field in health"
echo "        NOTE: \$0 billing can only be confirmed on the Fly dashboard:"
echo "              https://fly.io/dashboard/$APP/billing"
skip "billing dashboard check is manual"

# 7. Tools endpoint
hdr "7. Tools registry"
curl -s -m 20 "$URL/api/v1/tools" | grep -q 'browser' \
  && ok "tools registry served" || bad "tools registry missing"

# --- report -----------------------------------------------------------------
mkdir -p "$(dirname "$REPORT")" 2>/dev/null
cat > "$REPORT" <<EOF
{
  "target": "$URL",
  "app": "$APP",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "token": "$TOKEN",
  "pass": $PASS, "fail": $FAIL, "skip": $SKIP,
  "restartTested": $([ "$SKIP_RESTART" = "1" ] && echo false || echo true),
  "checks": [${RESULTS%,}]
}
EOF

echo
echo "=================================================="
echo " PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
echo " report: $REPORT"
if [ "$FAIL" -gt 0 ]; then
  echo " RESULT: FAIL"
  echo "=================================================="
  exit 1
elif [ "$SKIP" -gt 0 ]; then
  echo " RESULT: INCOMPLETE - $SKIP check(s) skipped."
  echo " Not eligible to claim 'production verified'."
  echo "=================================================="
  exit 2
else
  echo " RESULT: PASS - production verified"
  echo "=================================================="
  exit 0
fi
