#!/usr/bin/env bash
#
# test-persistence-restart.sh - proves API state survives a hard restart.
#
# Method: boot the server against a temp PERSISTENCE_PATH, write state, SIGKILL
# the process (so NO graceful shutdown hook can run), boot a fresh process
# against the same directory, and assert the state is still readable.
#
# SIGKILL matters: `fly machine restart` and OOM kills do not always give the
# process time to flush, so a test that relies on graceful shutdown proves
# nothing. Exits non-zero on failure.
#
set -uo pipefail
cd "$(dirname "$0")/.."

WORK="${WORK_DIR:-$(mktemp -d)}"
BUILD="$WORK/build"
DATA="$WORK/data"
PORT_A="${PORT_A:-3021}"
PORT_B="${PORT_B:-3022}"
TOKEN="RESTART_PROOF_$(date +%s)_$$"
FAIL=0

cleanup() {
  [ -n "${PID1:-}" ] && kill -9 "$PID1" 2>/dev/null
  [ -n "${PID2:-}" ] && kill -9 "$PID2" 2>/dev/null
  [ -z "${KEEP_WORK:-}" ] && rm -rf "$WORK"
  return 0
}
trap cleanup EXIT

mkdir -p "$BUILD" "$DATA"
export PERSISTENCE_PATH="$DATA"

echo "[build] compiling api-server -> $BUILD"
./node_modules/.bin/tsc -p services/api-server/tsconfig.json \
  --outDir "$BUILD" --composite false --sourceMap false --declaration false --declarationMap false \
  >"$WORK/tsc.log" 2>&1 || { echo "[build] FAILED"; cat "$WORK/tsc.log"; exit 1; }

cat > "$BUILD/boot.mjs" <<'EOF'
import { startApiServer } from './index.js';
startApiServer(Number(process.argv[2]));
EOF

wait_up() {
  for _ in $(seq 1 40); do
    curl -s -m 1 "localhost:$1/api/v1/health" >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  return 1
}

echo "[boot1] starting on :$PORT_A with PERSISTENCE_PATH=$DATA"
node "$BUILD/boot.mjs" "$PORT_A" >"$WORK/boot1.log" 2>&1 &
PID1=$!
wait_up "$PORT_A" || { echo "[boot1] server never came up"; cat "$WORK/boot1.log"; exit 1; }

echo "[write] creating conversation / message / mission tagged $TOKEN"
curl -s -X POST "localhost:$PORT_A/api/v1/conversations" \
  -H 'Content-Type: application/json' -d "{\"title\":\"$TOKEN\"}" >/dev/null
CONV=$(curl -s "localhost:$PORT_A/api/v1/conversations" \
  | python3 -c "import sys,json;print([c['id'] for c in json.load(sys.stdin)['conversations'] if c['title']=='$TOKEN'][0])")
curl -s -X POST "localhost:$PORT_A/api/v1/conversations/$CONV/messages" \
  -H 'Content-Type: application/json' -d "{\"content\":\"MSG_$TOKEN\"}" >/dev/null
curl -s -X POST "localhost:$PORT_A/api/v1/missions" \
  -H 'Content-Type: application/json' -d "{\"goal\":\"MISSION_$TOKEN\"}" >/dev/null
sleep 1
echo "[write] conversation=$CONV"

echo "[kill] SIGKILL $PID1 (no graceful flush)"
kill -9 "$PID1" 2>/dev/null; wait "$PID1" 2>/dev/null; PID1=""
sleep 1
if curl -s -m 2 "localhost:$PORT_A/api/v1/health" >/dev/null 2>&1; then
  echo "[kill] FAIL: server still responding"; exit 1
fi

echo "[disk] files under $DATA/api-server:"
ls -la "$DATA/api-server" | sed 's/^/       /'
grep -q "$TOKEN" "$DATA/api-server/conversations.json" \
  && echo "       conversations.json has token" || { echo "       FAIL conversations.json missing token"; FAIL=1; }

echo "[boot2] starting fresh process on :$PORT_B against same dir"
node "$BUILD/boot.mjs" "$PORT_B" >"$WORK/boot2.log" 2>&1 &
PID2=$!
wait_up "$PORT_B" || { echo "[boot2] server never came up"; cat "$WORK/boot2.log"; exit 1; }
grep -i 'Loaded persistence' "$WORK/boot2.log" | head -1 | sed 's/^/       /'

echo "[verify] reading state back after restart"
curl -s "localhost:$PORT_B/api/v1/conversations" | grep -q "$TOKEN" \
  && echo "       PASS conversation survived" || { echo "       FAIL conversation lost"; FAIL=1; }
curl -s "localhost:$PORT_B/api/v1/conversations/$CONV/messages" | grep -q "MSG_$TOKEN" \
  && echo "       PASS message survived" || { echo "       FAIL message lost"; FAIL=1; }
curl -s "localhost:$PORT_B/api/v1/missions" | grep -q "MISSION_$TOKEN" \
  && echo "       PASS mission survived" || { echo "       FAIL mission lost"; FAIL=1; }

echo
if [ "$FAIL" -eq 0 ]; then
  echo "RESULT: PASS - state survived SIGKILL + restart"
else
  echo "RESULT: FAIL - state did not survive restart"
fi
exit $FAIL
