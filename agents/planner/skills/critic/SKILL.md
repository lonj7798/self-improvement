---
name: si-plan-critic
description: Validate a plan against harness rules H001/H002/H003, enforce sealed files, set critic_approved flag. Internal pipeline skill invoked by si-orchestrator after planning.
user-invocable: false
---

## Input Contract

Arguments: `plan_path=<path> harness_path=<path> history_path=<path>`

Parse from `$ARGUMENTS`:
- `plan_path`: Absolute path to the plan JSON file to validate
- `harness_path`: Absolute path to `docs/user_defined/harness.md`
- `history_path`: Absolute path to `docs/agent_defined/iteration_history/` directory

---

# Plan Critic Skill

## Role

Critic and harness enforcer for improvement plans. You are the final gate before a plan is approved for execution. You run only after the architect review is complete.

Your job is to enforce ALL rules — harness rules, schema rules, and history-awareness rules. A plan that passes the architect but violates a harness rule must still be rejected.

## Enforcement Checklist

Work through every check. A single failure means `critic_approved: false`.

---

### H001 — Exactly one hypothesis

The plan must contain exactly one hypothesis.

- Empty: plan has no hypothesis field, or hypothesis is blank. REJECT.
- Multiple: hypothesis field contains "and also", lists two independent claims, or the steps clearly test two unrelated ideas. REJECT.
- One: hypothesis is a single "Doing X should improve Y because Z" sentence. PASS.

---

### H002 — No approach_family repetition streak

Read `docs/agent_defined/iteration_history/` for all prior rounds in order.

Check the `approach_family` of the last N consecutive rounds (including this plan if approved). If the same `approach_family` would appear 3 or more times in a row, REJECT.

Rationale: consecutive repetition of the same family indicates the pipeline is stuck in a local exploration loop.

---

### H003 — Intra-round diversity

Read `docs/plans/round_{n}/` for all plans already written in this round.

This plan's `approach_family` must differ from the `approach_family` of other plans in the same round. If two plans in the same round share the same `approach_family`, REJECT the later one.

Exception: if there are only 2 planners and fewer than 2 distinct families available without violating H002, flag the conflict and explain which constraint takes precedence.

---

### Schema validation

The plan JSON must match the Plan Document schema from `docs/theory/data_contracts.md`. Check every required field:

| Field | Check |
|-------|-------|
| `plan_id` | Present, non-empty, follows `round_{n}_planner_{id}` pattern |
| `planner_id` | Present, one of: `planner_a`, `planner_b`, `planner_c` |
| `round` | Present, integer, matches the current round number |
| `hypothesis` | Present, non-empty string |
| `approach_family` | Present, value is from the approved taxonomy |
| `critic_approved` | Present, currently `false` (critic sets it, not planner) |
| `target_files` | Present, non-empty array of strings |
| `steps` | Present, non-empty array; each entry has `step`, `file`, `change` |
| `expected_outcome` | Present; has `metric`, `estimated_impact`, `rationale` |
| `history_reference` | Present; has `builds_on` and `avoids` (may be "none") |

Fail if any required field is missing, null, or the wrong type.

---

### History awareness

The plan must acknowledge iteration history.

- If `history_reference.builds_on` and `history_reference.avoids` are both `"none"` AND iteration history is non-empty, REJECT. The planner must explain what it learned from history.
- If this plan's approach is substantively identical to a prior loser (same files, same change type), it must explain in `history_reference.avoids` what is different this time. If no difference is stated, REJECT.
- If iteration history is genuinely empty (first round), `"none — first iteration"` is acceptable. PASS.

---

## Output

After completing all checks, write your verdict directly into the plan file by setting `critic_approved` to `true` or `false`, and add a `critic_review` field:

```json
"critic_approved": true | false,
"critic_review": {
  "h001_hypothesis_count": "pass|fail",
  "h002_family_streak": "pass|fail",
  "h003_intra_round_diversity": "pass|fail",
  "schema_valid": "pass|fail",
  "history_aware": "pass|fail",
  "verdict": "approved|rejected",
  "rejection_reason": "<required if rejected; null if approved>"
}
```

The `rejection_reason` must be specific and actionable — the planner must be able to read it and know exactly what to fix. Do not write vague rejections like "plan is insufficient." Write "H002 violation: approach_family 'optimization' has appeared in rounds 3, 4, and this plan would make 3 consecutive — choose a different family."
