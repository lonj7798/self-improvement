#!/usr/bin/env bash
# validate.sh — Deterministic enforcement for the self-improvement loop system.
# Usage:
#   ./scripts/validate.sh              # sealed file check only
#   ./scripts/validate.sh plan.json    # + plan schema validation
#   ./scripts/validate.sh plan.json result.json  # + result schema validation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SETTINGS="${PROJECT_ROOT}/docs/user_defined/settings.json"

VALID_APPROACH_FAMILIES="architecture training_config data infrastructure optimization testing documentation other"

# ── helpers ────────────────────────────────────────────────────────────────────

err() { echo "ERROR: $*" >&2; }
ok()  { echo "OK: $*"; }

require_jq() {
    if ! command -v jq &>/dev/null; then
        err "jq is not installed. Install it with: brew install jq  (macOS) or apt-get install jq (Linux)"
        exit 1
    fi
}

# ── check a: sealed file check ─────────────────────────────────────────────────

check_sealed_files() {
    require_jq

    if [[ ! -f "${SETTINGS}" ]]; then
        err "Settings file not found: ${SETTINGS}"
        exit 1
    fi

    # Check if sealed_files key exists and is a non-null, non-empty array
    has_sealed=$(jq -r 'if (.sealed_files | type) == "array" and (.sealed_files | length) > 0 then "yes" else "no" end' "${SETTINGS}" 2>/dev/null || echo "no")

    if [[ "${has_sealed}" != "yes" ]]; then
        ok "No sealed files configured — skipping sealed file check."
        return 0
    fi

    # Not a git repo — skip
    if ! git -C "${PROJECT_ROOT}" rev-parse --git-dir &>/dev/null 2>&1; then
        ok "Not a git repository — skipping sealed file check."
        return 0
    fi

    # Collect modified files into a newline-separated string
    modified_files_str=$(git -C "${PROJECT_ROOT}" diff --name-only HEAD 2>/dev/null || true)

    if [[ -z "${modified_files_str}" ]]; then
        ok "No modified files detected."
        return 0
    fi

    # Check each sealed file against each modified file
    violations=""
    while IFS= read -r sealed; do
        [[ -z "${sealed}" ]] && continue
        while IFS= read -r modified; do
            [[ -z "${modified}" ]] && continue
            if [[ "${modified}" == "${sealed}" ]]; then
                violations="${violations} ${modified}"
            fi
        done <<< "${modified_files_str}"
    done < <(jq -r '.sealed_files[]' "${SETTINGS}" 2>/dev/null)

    if [[ -n "${violations}" ]]; then
        err "Sealed file(s) were modified:${violations}"
        err "These files are protected and must not be changed."
        exit 1
    fi

    modified_count=$(echo "${modified_files_str}" | wc -l | tr -d ' ')
    ok "Sealed file check passed (${modified_count} modified, none sealed)."
}

# ── check b+d+e: plan schema validation ────────────────────────────────────────

check_plan_schema() {
    local plan_file="$1"
    require_jq

    if [[ ! -f "${plan_file}" ]]; then
        err "Plan file not found: ${plan_file}"
        exit 1
    fi

    local required_fields="plan_id planner_id hypothesis approach_family critic_approved target_files steps expected_outcome"
    local missing=""

    for field in ${required_fields}; do
        val=$(jq -r --arg f "${field}" '.[$f]' "${plan_file}" 2>/dev/null)
        if [[ "${val}" == "null" || -z "${val}" ]]; then
            missing="${missing} ${field}"
        fi
    done

    if [[ -n "${missing}" ]]; then
        err "Plan is missing required fields:${missing}"
        exit 1
    fi

    ok "Plan contains all required fields."

    # check d: one-hypothesis check — hypothesis must be a non-empty string, not array
    hypothesis_type=$(jq -r '.hypothesis | type' "${plan_file}" 2>/dev/null)
    if [[ "${hypothesis_type}" != "string" ]]; then
        err "hypothesis must be a string (not ${hypothesis_type}). Only one hypothesis per plan is allowed."
        exit 1
    fi

    hypothesis_val=$(jq -r '.hypothesis' "${plan_file}")
    if [[ -z "${hypothesis_val}" ]]; then
        err "hypothesis field is empty. A non-empty hypothesis string is required."
        exit 1
    fi

    ok "One-hypothesis check passed: hypothesis is a non-empty string."

    # check e: approach_family must be one of the valid values
    approach=$(jq -r '.approach_family' "${plan_file}")
    local valid=0
    for family in ${VALID_APPROACH_FAMILIES}; do
        if [[ "${approach}" == "${family}" ]]; then
            valid=1
            break
        fi
    done

    if [[ ${valid} -eq 0 ]]; then
        err "approach_family '${approach}' is not valid. Must be one of: ${VALID_APPROACH_FAMILIES}"
        exit 1
    fi

    ok "Approach family check passed: '${approach}' is valid."
}

# ── check c: result schema validation ──────────────────────────────────────────

check_result_schema() {
    local result_file="$1"
    require_jq

    if [[ ! -f "${result_file}" ]]; then
        err "Result file not found: ${result_file}"
        exit 1
    fi

    local required_fields="executor_id plan_id benchmark_score status timestamp"
    local missing=""

    for field in ${required_fields}; do
        val=$(jq -r --arg f "${field}" '.[$f]' "${result_file}" 2>/dev/null)
        if [[ "${val}" == "null" || -z "${val}" ]]; then
            missing="${missing} ${field}"
        fi
    done

    if [[ -n "${missing}" ]]; then
        err "Result is missing required fields:${missing}"
        exit 1
    fi

    ok "Result contains all required fields."
}

# ── main ───────────────────────────────────────────────────────────────────────

main() {
    echo "=== validate.sh ==="

    # Always run the sealed file check
    check_sealed_files

    if [[ $# -ge 1 ]]; then
        check_plan_schema "$1"
    fi

    if [[ $# -ge 2 ]]; then
        check_result_schema "$2"
    fi

    echo "=== All checks passed ==="
}

main "$@"
