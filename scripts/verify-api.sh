#!/usr/bin/env bash
# Critical-path check against a running server, using raw HTTP requests (no UI).
# Usage: scripts/verify-api.sh [base_url] [refund_id]   (run `npm run seed` first for a clean state)
set -u
BASE="${1:-http://localhost:3000}"
ID="${2:-RF-1002}"
URL="$BASE/api/refunds/$ID/decision"
fail=0

check() { # name expected_status curl-args...
  local name="$1" want="$2"; shift 2
  local got
  got=$(curl -s -o /tmp/verify-body -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then echo "PASS $name -> $got $(cat /tmp/verify-body)"; else echo "FAIL $name -> got $got want $want $(cat /tmp/verify-body)"; fail=1; fi
}

J='-H content-type:application/json'
check "no identity cannot decide"         401 -X POST $J -d '{"decision":"approve","reason":"x"}' "$URL"
check "unknown identity cannot decide"    401 -X POST $J -b demo_user=mallory -d '{"decision":"approve","reason":"x"}' "$URL"
check "viewer cannot decide"              403 -X POST $J -b demo_user=vera -d '{"decision":"approve","reason":"x"}' "$URL"
check "admin cannot decide"               403 -X POST $J -b demo_user=ada  -d '{"decision":"approve","reason":"x"}' "$URL"
check "blank reason rejected"             400 -X POST $J -b demo_user=riley -d '{"decision":"approve","reason":"  "}' "$URL"
check "invalid decision rejected"         400 -X POST $J -b demo_user=riley -d '{"decision":"maybe","reason":"x"}' "$URL"
check "reviewer approves"                 200 -X POST $J -b demo_user=riley -d '{"decision":"approve","reason":"verify-api.sh"}' "$URL"
check "second decision rejected"          409 -X POST $J -b demo_user=rana  -d '{"decision":"reject","reason":"again"}' "$URL"
check "detail shows decision + 1 audit"   200 -b demo_user=vera "$BASE/api/refunds/$ID"
n=$(grep -o '"action":"refund\.' /tmp/verify-body | wc -l)
if [ "$n" = "1" ]; then echo "PASS exactly one audit event"; else echo "FAIL audit events: $n"; fail=1; fi
exit $fail
