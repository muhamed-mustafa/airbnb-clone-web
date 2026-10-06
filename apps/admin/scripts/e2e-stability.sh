#!/usr/bin/env bash
# Repeats the timing-dependent e2e tests (session refresh + filter debounce) against the
# current build. No retries; one log, one JSON report and one results/traces folder per run;
# exit codes are taken through the pipe with pipefail.
# Usage: scripts/e2e-stability.sh [output-dir] [runs]   (build first: pnpm exec next build)
set -u -o pipefail
cd "$(dirname "$0")/.." || exit 1
OUT=${1:-test-reports/stability}
RUNS=${2:-20}
mkdir -p "$OUT"
SUMMARY=$OUT/summary.txt
echo "stability run started $(date -Iseconds) at $(git rev-parse --short HEAD)$(git diff --quiet HEAD || echo ' + uncommitted changes')" > "$SUMMARY"
failures=0
for i in $(seq -w 1 "$RUNS"); do
  start=$(date +%s)
  E2E_SKIP_BUILD=1 pnpm exec playwright test e2e/session.spec.ts e2e/filters.spec.ts \
    --retries=0 --output="$OUT/run-$i-results" 2>&1 | tee "$OUT/run-$i.log" > /dev/null
  code=$?
  [ "$code" -ne 0 ] && failures=$((failures + 1))
  # The JSON reporter writes test-reports/e2e-<timestamp>.json; keep it with its run.
  json=$(ls -t test-reports/e2e-*.json 2>/dev/null | head -1)
  [ -n "$json" ] && mv "$json" "$OUT/run-$i.json"
  passed=$(grep -Eo '[0-9]+ passed' "$OUT/run-$i.log" | tail -1)
  failed=$(grep -Eo '[0-9]+ failed' "$OUT/run-$i.log" | tail -1)
  echo "run $i exit=$code ${passed:-0 passed} ${failed:-0 failed} $(( $(date +%s) - start ))s" | tee -a "$SUMMARY"
done
echo "finished $(date -Iseconds): $failures of $RUNS runs failed" | tee -a "$SUMMARY"
[ "$failures" -eq 0 ]
