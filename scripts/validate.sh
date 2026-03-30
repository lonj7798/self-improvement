#!/usr/bin/env bash
# validate.sh — Deterministic enforcement for the self-improvement loop system.
# Usage:
#   ./scripts/validate.sh              # sealed file check only
#   ./scripts/validate.sh plan.json    # + plan schema validation
#   ./scripts/validate.sh plan.json result.json  # + result schema validation
#   ./scripts/validate.sh --worktree /path plan.json result.json  # worktree mode

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SETTINGS="${PROJECT_ROOT}/docs/user_defined/settings.json"
SEALED_HASHES_FILE="${PROJECT_ROOT}/.sealed_hashes"
HARNESS_FILE="${PROJECT_ROOT}/docs/user_defined/harness.md"

VALID_APPROACH_FAMILIES="architecture training_config data infrastructure optimization testing documentation other"

# Parse --worktree flag
WORKTREE_PATH=""
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --worktree)
            WORKTREE_PATH="$2"
            shift 2
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done
set -- "${POSITIONAL_ARGS[@]+"${POSITIONAL_ARGS[@]}"}"

# Determine git working directory (worktree or project root)
GIT_DIR="${WORKTREE_PATH:-${PROJECT_ROOT}}"

# ── helpers ────────────────────────────────────────────────────────────────────

err() { echo "ERROR: $*" >&2; }
ok()  { echo "OK: $*"; }

require_jq() {
    if ! command -v jq &>/dev/null; then
        err "jq is not installed. Install it with: brew install jq  (macOS) or apt-get install jq (Linux)"
        exit 1
    fi
}

load_custom_families() {
    # Parse custom approach families from harness.md if present
    if [[ -f "${HARNESS_FILE}" ]]; then
        local in_section=0
        while IFS= read -r line; do
            if [[ "${line}" == "## Custom Approach Families"* ]]; then
                in_section=1
                continue
            fi
            if [[ ${in_section} -eq 1 ]]; then
                # Stop at next section
                if [[ "${line}" == "## "* ]]; then
                    break
                fi
                # Extract family names (lines starting with - or *)
                local family
                family=$(echo "${line}" | sed -n 's/^[[:space:]]*[-*][[:space:]]*`\?\([a-z_]*\)`\?.*/\1/p')
                if [[ -n "${family}" ]]; then
                    VALID_APPROACH_FAMILIES="${VALID_APPROACH_FAMILIES} ${family}"
                fi
            fi
        done < "${HARNESS_FILE}"
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
    if ! git -C "${GIT_DIR}" rev-parse --git-dir &>/dev/null 2>&1; then
        ok "Not a git repository — skipping sealed file check."
        return 0
    fi

    # Collect modified files: use diff against the improvement branch HEAD
    # In worktree mode, compare against the base commit; otherwise compare working tree
    if [[ -n "${WORKTREE_PATH}" ]]; then
        # Compare worktree state against its branch point (the improvement branch)
        # Find the parent branch by looking for improve/* or falling back to main/master
        local base_commit
        local improve_branch
        improve_branch=$(git -C "${GIT_DIR}" branch -a --list 'improve/*' 2>/dev/null | head -1 | tr -d ' *' || true)
        if [[ -z "${improve_branch}" ]]; then
            # Fallback: find the merge-base with main or master
            improve_branch=$(git -C "${GIT_DIR}" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
        fi
        base_commit=$(git -C "${GIT_DIR}" merge-base HEAD "${improve_branch}" 2>/dev/null || echo "HEAD~1")
        modified_files_str=$(git -C "${GIT_DIR}" diff --name-only "${base_commit}" 2>/dev/null || true)
        # Also include uncommitted changes
        local uncommitted
        uncommitted=$(git -C "${GIT_DIR}" diff --name-only 2>/dev/null || true)
        if [[ -n "${uncommitted}" ]]; then
            modified_files_str="${modified_files_str}"$'\n'"${uncommitted}"
        fi
    else
        # Default: check both staged and unstaged changes
        modified_files_str=$(git -C "${GIT_DIR}" diff --name-only HEAD 2>/dev/null || true)
        local staged
        staged=$(git -C "${GIT_DIR}" diff --name-only --cached 2>/dev/null || true)
        if [[ -n "${staged}" ]]; then
            modified_files_str="${modified_files_str}"$'\n'"${staged}"
        fi
    fi

    # Deduplicate
    if [[ -n "${modified_files_str}" ]]; then
        modified_files_str=$(echo "${modified_files_str}" | sort -u)
    fi

    if [[ -z "${modified_files_str}" ]]; then
        ok "No modified files detected."
    else
        # Check each sealed file against each modified file
        violations=""
        while IFS= read -r sealed; do
            [[ -z "${sealed}" ]] && continue
            while IFS= read -r modified; do
                [[ -z "${modified}" ]] && continue
                if [[ "${sealed}" == */ ]]; then
                    # Directory pattern: match any file within this directory
                    [[ "${modified}" == "${sealed}"* ]] && violations="${violations} ${modified}"
                else
                    # Exact file match
                    [[ "${modified}" == "${sealed}" ]] && violations="${violations} ${modified}"
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
    fi

    # Hash-lock verification (defense in depth)
    check_sealed_hashes
}

check_sealed_hashes() {
    if [[ ! -f "${SEALED_HASHES_FILE}" ]]; then
        echo "Warning: .sealed_hashes manifest not found — skipping hash verification."
        echo "  Run initial_setup.py step 4 to generate the manifest."
        return 0
    fi

    if ! command -v shasum &>/dev/null && ! command -v sha256sum &>/dev/null; then
        echo "Warning: neither shasum nor sha256sum found — skipping hash verification."
        return 0
    fi

    local want_to_improve="${GIT_DIR}"
    if [[ -z "${WORKTREE_PATH}" ]]; then
        want_to_improve="${PROJECT_ROOT}/want_to_improve"
    fi

    local hash_violations=""
    while IFS= read -r file_path; do
        [[ -z "${file_path}" ]] && continue
        local expected_hash
        expected_hash=$(jq -r --arg f "${file_path}" '.[$f]' "${SEALED_HASHES_FILE}" 2>/dev/null)
        [[ "${expected_hash}" == "null" || -z "${expected_hash}" ]] && continue

        local full_path="${want_to_improve}/${file_path}"
        if [[ ! -f "${full_path}" ]]; then
            hash_violations="${hash_violations} ${file_path}(missing)"
            continue
        fi

        local actual_hash
        if command -v sha256sum &>/dev/null; then
            actual_hash=$(sha256sum "${full_path}" | awk '{print $1}')
        else
            actual_hash=$(shasum -a 256 "${full_path}" | awk '{print $1}')
        fi

        if [[ "${actual_hash}" != "${expected_hash}" ]]; then
            hash_violations="${hash_violations} ${file_path}"
        fi
    done < <(jq -r 'keys[]' "${SEALED_HASHES_FILE}" 2>/dev/null)

    if [[ -n "${hash_violations}" ]]; then
        err "Sealed file hash mismatch detected:${hash_violations}"
        err "These files have been modified since setup. This violates sealed evaluation."
        exit 1
    fi

    ok "Sealed file hash verification passed."
}

# ── check b+d+e: plan schema validation ────────────────────────────────────────

check_plan_schema() {
    local plan_file="$1"
    require_jq

    if [[ ! -f "${plan_file}" ]]; then
        err "Plan file not found: ${plan_file}"
        exit 1
    fi

    local required_fields="plan_id planner_id round hypothesis approach_family critic_approved target_files steps expected_outcome history_reference"
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

    # check: critic_approved must be explicitly true or false (not truthy string)
    critic_val=$(jq -r '.critic_approved' "${plan_file}" 2>/dev/null)
    if [[ "${critic_val}" != "true" && "${critic_val}" != "false" ]]; then
        err "critic_approved must be a boolean (true or false), got: '${critic_val}'"
        exit 1
    fi

    ok "critic_approved is a valid boolean: ${critic_val}"

    # check: target_files must be a non-empty array
    target_files_len=$(jq '.target_files | length' "${plan_file}" 2>/dev/null || echo "0")
    if [[ "${target_files_len}" -eq 0 ]]; then
        err "target_files must be a non-empty array (got length 0)."
        exit 1
    fi

    ok "target_files is non-empty (${target_files_len} file(s))."

    # check: steps must be a non-empty array
    steps_len=$(jq '.steps | length' "${plan_file}" 2>/dev/null || echo "0")
    if [[ "${steps_len}" -eq 0 ]]; then
        err "steps must be a non-empty array (got length 0)."
        exit 1
    fi

    ok "steps is non-empty (${steps_len} step(s))."

    # check: each step must have step, file, change sub-fields
    for i in $(seq 0 $((steps_len - 1))); do
        for sub in step file change; do
            val=$(jq -r --argjson i "$i" --arg f "$sub" '.steps[$i][$f]' "${plan_file}" 2>/dev/null)
            if [[ "${val}" == "null" || -z "${val}" ]]; then
                err "steps[$i] is missing required field: ${sub}"
                exit 1
            fi
        done
    done

    ok "All steps have required sub-fields (step, file, change)."

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

    # check: expected_outcome must have required sub-fields
    local eo_fields="metric estimated_impact rationale"
    local eo_missing=""
    for field in ${eo_fields}; do
        val=$(jq -r --arg f "${field}" '.expected_outcome[$f]' "${plan_file}" 2>/dev/null)
        if [[ "${val}" == "null" || -z "${val}" ]]; then
            eo_missing="${eo_missing} ${field}"
        fi
    done

    if [[ -n "${eo_missing}" ]]; then
        err "expected_outcome is missing required sub-fields:${eo_missing}"
        exit 1
    fi

    ok "expected_outcome sub-fields are complete."

    # check: history_reference must have required sub-fields
    local hr_fields="builds_on avoids"
    local hr_missing=""
    for field in ${hr_fields}; do
        val=$(jq -r --arg f "${field}" '.history_reference[$f]' "${plan_file}" 2>/dev/null)
        if [[ "${val}" == "null" || -z "${val}" ]]; then
            hr_missing="${hr_missing} ${field}"
        fi
    done

    if [[ -n "${hr_missing}" ]]; then
        err "history_reference is missing required sub-fields:${hr_missing}"
        exit 1
    fi

    ok "history_reference sub-fields are complete."
}

# ── check c: result schema validation ──────────────────────────────────────────

check_result_schema() {
    local result_file="$1"
    require_jq

    if [[ ! -f "${result_file}" ]]; then
        err "Result file not found: ${result_file}"
        exit 1
    fi

    local required_fields="executor_id plan_id benchmark_score status timestamp benchmark_raw"
    local missing=""

    for field in ${required_fields}; do
        val=$(jq -r --arg f "${field}" '.[$f]' "${result_file}" 2>/dev/null)
        if [[ "${val}" == "null" || -z "${val}" ]]; then
            # benchmark_raw can be empty string on error/timeout, benchmark_score can be 0
            if [[ "${field}" == "benchmark_raw" ]]; then
                # Check it exists (even if empty)
                exists=$(jq --arg f "${field}" 'has($f)' "${result_file}" 2>/dev/null || echo "false")
                if [[ "${exists}" != "true" ]]; then
                    missing="${missing} ${field}"
                fi
            elif [[ "${field}" == "benchmark_score" ]]; then
                # Allow 0 as a valid score
                exists=$(jq --arg f "${field}" 'has($f)' "${result_file}" 2>/dev/null || echo "false")
                if [[ "${exists}" != "true" ]]; then
                    missing="${missing} ${field}"
                fi
            else
                missing="${missing} ${field}"
            fi
        fi
    done

    if [[ -n "${missing}" ]]; then
        err "Result is missing required fields:${missing}"
        exit 1
    fi

    ok "Result contains all required fields."

    # Validate status enum
    local status
    status=$(jq -r '.status' "${result_file}" 2>/dev/null)
    case "${status}" in
        success|regression|error|timeout) ;;
        *)
            err "Invalid status '${status}'. Must be one of: success, regression, error, timeout"
            exit 1
            ;;
    esac

    ok "Status '${status}' is valid."

    # Check failure_analysis on non-success status
    if [[ "${status}" != "success" ]]; then
        local fa_type
        fa_type=$(jq -r '.failure_analysis | type' "${result_file}" 2>/dev/null)
        if [[ "${fa_type}" != "object" ]]; then
            err "failure_analysis must be a non-null object when status is '${status}' (got ${fa_type})"
            exit 1
        fi

        # Verify failure_analysis has required fields
        local fa_fields="what why category lesson"
        local fa_missing=""
        for field in ${fa_fields}; do
            val=$(jq -r --arg f "${field}" '.failure_analysis[$f]' "${result_file}" 2>/dev/null)
            if [[ "${val}" == "null" || -z "${val}" ]]; then
                fa_missing="${fa_missing} ${field}"
            fi
        done

        if [[ -n "${fa_missing}" ]]; then
            err "failure_analysis is missing required fields:${fa_missing}"
            exit 1
        fi

        ok "failure_analysis is complete for non-success status."

        # Validate failure_analysis.category enum
        local fa_category
        fa_category=$(jq -r '.failure_analysis.category' "${result_file}" 2>/dev/null)
        local valid_categories="oom timeout regression logic_error scope_error infrastructure benchmark_parse_error sealed_file_violation"
        local cat_valid=0
        for cat in ${valid_categories}; do
            if [[ "${fa_category}" == "${cat}" ]]; then
                cat_valid=1
                break
            fi
        done

        if [[ ${cat_valid} -eq 0 ]]; then
            err "failure_analysis.category '${fa_category}' is not valid. Must be one of: ${valid_categories}"
            exit 1
        fi

        ok "failure_analysis.category '${fa_category}' is valid."
    fi

    # Validate sub_scores field (if present)
    local has_sub_scores
    has_sub_scores=$(jq 'has("sub_scores")' "${result_file}" 2>/dev/null || echo "false")
    if [[ "${has_sub_scores}" == "true" ]]; then
        local sub_scores_type
        sub_scores_type=$(jq -r '.sub_scores | type' "${result_file}" 2>/dev/null)
        if [[ "${sub_scores_type}" == "null" ]]; then
            ok "sub_scores is null (single-score mode)."
        elif [[ "${sub_scores_type}" == "object" ]]; then
            # Verify all values are numbers or null
            local invalid_values
            invalid_values=$(jq -r '.sub_scores | to_entries[] | select(.value != null and (.value | type) != "number") | .key' "${result_file}" 2>/dev/null)
            if [[ -n "${invalid_values}" ]]; then
                err "sub_scores contains non-numeric values for keys: ${invalid_values}"
                exit 1
            fi
            # Verify all keys are non-empty strings
            local empty_keys
            empty_keys=$(jq -r '.sub_scores | keys[] | select(length == 0)' "${result_file}" 2>/dev/null)
            if [[ -n "${empty_keys}" ]]; then
                err "sub_scores contains empty string keys"
                exit 1
            fi
            local sub_scores_count
            sub_scores_count=$(jq '.sub_scores | length' "${result_file}" 2>/dev/null)
            ok "sub_scores is a valid object (${sub_scores_count} dimension(s))."
        else
            err "sub_scores must be an object or null (got ${sub_scores_type})"
            exit 1
        fi
    fi
}

# ── main ───────────────────────────────────────────────────────────────────────

main() {
    echo "=== validate.sh ==="

    # Load custom approach families from harness
    load_custom_families

    # Always run the sealed file check
    check_sealed_files

    if [[ ${#POSITIONAL_ARGS[@]} -ge 1 ]]; then
        check_plan_schema "${POSITIONAL_ARGS[0]}"
    fi

    if [[ ${#POSITIONAL_ARGS[@]} -ge 2 ]]; then
        check_result_schema "${POSITIONAL_ARGS[1]}"
    fi

    echo "=== All checks passed ==="
}

main
