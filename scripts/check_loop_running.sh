#!/usr/bin/env bash
# Stop hook: if the improvement loop status is "running", block the stop
# so Claude continues working autonomously.
# Uses standard Claude Code Stop hook format: decision: "block"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
AGENT_SETTINGS="${PROJECT_ROOT}/docs/agent_defined/settings.json"
ITERATION_STATE="${PROJECT_ROOT}/docs/agent_defined/iteration_state.json"

if [[ ! -f "${AGENT_SETTINGS}" ]]; then
  exit 0
fi

status=$(jq -r '.status // "idle"' "${AGENT_SETTINGS}" 2>/dev/null || echo "idle")

if [[ "${status}" == "running" ]]; then
  iterations=$(jq -r '.iterations // 0' "${AGENT_SETTINGS}" 2>/dev/null || echo "0")
  best_score=$(jq -r '.best_score // "null"' "${AGENT_SETTINGS}" 2>/dev/null || echo "null")
  current_step="unknown"
  if [[ -f "${ITERATION_STATE}" ]]; then
    current_step=$(jq -r '.current_step // "unknown"' "${ITERATION_STATE}" 2>/dev/null || echo "unknown")
  fi

  next_iteration=$((iterations + 1))

  cat <<EOF
{
  "decision": "block",
  "reason": "IMPROVEMENT LOOP IS STILL RUNNING (iteration ${next_iteration}, best_score: ${best_score}, last step: ${current_step}). First re-read docs/user_defined/settings.json and docs/agent_defined/settings.json for latest config (user may have changed settings). Then read docs/agent_defined/iteration_state.json to find where you left off. Continue from there following CLAUDE.md Steps 5-10. Do NOT pause or ask the user."
}
EOF
fi
