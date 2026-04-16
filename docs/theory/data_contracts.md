# Data Contracts: Inter-Agent Communication Schemas

This document defines the canonical JSON schemas for all messages exchanged between agents in the self-improvement loop system. Every agent must produce and consume exactly these shapes. Breaking changes require a version bump and migration notes.

---

## Table of Contents

1. [Plan Document](#1-plan-document)
2. [Benchmark Result](#2-benchmark-result)
3. [Research Brief](#3-research-brief)
4. [Iteration History Record](#4-iteration-history-record)
5. [Visualization Data](#5-visualization-data)
6. [Approach Family Taxonomy](#6-approach-family-taxonomy)
7. [Failure Analysis Object](#7-failure-analysis-object)
8. [Iteration State](#8-iteration-state)
9. [Merge Report](#9-merge-report)
10. [Plan Archive](#10-plan-archive)
11. [Event Log](#11-event-log)
12. [Goal Phase](#12-goal-phase)
13. [Teammate Registry](#13-teammate-registry)
14. [Continuation Planner Notebook](#14-continuation-planner-notebook)
15. [Findings Entry](#15-findings-entry)
16. [Retrospection Signal](#16-retrospection-signal)
17. [Hybrid Plan Metadata](#17-hybrid-plan-metadata)
18. [De-Risk Result](#18-de-risk-result)

---

## 1. Plan Document

**Producer:** planner
**Consumer:** critic, executor

A plan document encodes a single, testable hypothesis along with the ordered steps needed to implement it. Each planner produces exactly one plan per round. The critic must approve the plan before the executor acts on it.

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `plan_id` | string | yes | Unique identifier scoped to a round and planner. Format: `round_{N}_{planner_id}`. |
| `planner_id` | string | yes | Identifier of the planner agent that produced this plan. |
| `round` | integer | yes | The iteration number this plan belongs to. |
| `hypothesis` | string | yes | A single, falsifiable hypothesis. Must be specific enough to determine whether it was confirmed or refuted by the benchmark result. |
| `approach_family` | string | yes | Structured tag from the [Approach Family Taxonomy](#6-approach-family-taxonomy). Used for deduplication and history analysis. |
| `critic_approved` | boolean | yes | Set to `true` by the critic after review. Plans with `false` must not be executed. |
| `target_files` | array of strings | yes | Relative paths to the files the executor is permitted to modify. Acts as an implicit scope boundary. |
| `steps` | array of objects | yes | Ordered list of concrete changes. Each object has fields: `step` (integer), `file` (string), `change` (string — exact description of change). |
| `expected_outcome` | object | yes | Structured prediction. Fields: `metric` (string — metric from goal.md), `estimated_impact` (string — quantified or qualified estimate), `rationale` (string — why this impact is expected). |
| `history_reference` | object | yes | Links to prior iterations. Fields: `builds_on` (string — prior success this extends, or `"none"`), `avoids` (string — prior failure this sidesteps, and how). |
| `critic_review` | object | no | Set by the critic. Fields: `h001_hypothesis_count`, `h002_family_streak`, `h003_intra_round_diversity`, `schema_valid`, `history_aware` (all `"pass"` or `"fail"`), `verdict` (`"approved"` or `"rejected"`), `rejection_reason` (string or null). |
| `architect_review` | object | no | Set by the plan architect (advisory only — does not gate execution). Fields: `verdict` (`"approve"` or `"reject"`), `feedback` (string), `structural_concerns` (array of strings). |

### Example

```json
{
  "plan_id": "round_1_planner_a",
  "planner_id": "planner_a",
  "round": 1,
  "hypothesis": "Switching to AdamW optimizer will improve convergence",
  "approach_family": "training_config",
  "critic_approved": true,
  "target_files": ["train.py"],
  "steps": [
    { "step": 1, "file": "train.py", "change": "Replace SGD optimizer with AdamW" },
    { "step": 2, "file": "train.py", "change": "Set lr=0.001, weight_decay=0.01" }
  ],
  "expected_outcome": {
    "metric": "val_loss",
    "estimated_impact": "~3% improvement",
    "rationale": "AdamW handles weight decay correctly and converges faster on similar architectures"
  },
  "history_reference": {
    "builds_on": "none — first iteration",
    "avoids": "none — first iteration"
  },
  "critic_review": {
    "h001_hypothesis_count": "pass",
    "h002_family_streak": "pass",
    "h003_intra_round_diversity": "pass",
    "schema_valid": "pass",
    "history_aware": "pass",
    "verdict": "approved",
    "rejection_reason": null
  }
}
```

---

## 2. Benchmark Result

**Producer:** executor
**Consumer:** github_manager

A benchmark result records the outcome of executing a plan. The executor fills this after running the benchmark suite. On failure, `failure_analysis` must be populated with a structured breakdown.

### Fields

| Field | Type | Description |
|---|---|---|
| `executor_id` | string | Identifier of the executor agent that ran the plan. |
| `plan_id` | string | The `plan_id` from the plan document this result corresponds to. Links result back to plan. |
| `benchmark_score` | number | Numeric value of the primary metric. Higher is better unless otherwise specified in `settings.json`. |
| `benchmark_raw` | string | Raw stdout/output string from the benchmark run, preserved verbatim for debugging. |
| `status` | string | One of: `success`, `regression`, `error`, `timeout`. See status definitions below. |
| `sub_scores` | object or null | Optional dictionary of additional scoring dimensions. Keys are metric names (strings), values are numeric scores. `null` or `{}` when the benchmark produces only a single score. Discovered from benchmark output (schemaless — no upfront declaration required). |
| `failure_analysis` | object or null | `null` on `success`. On any other status, a populated [Failure Analysis Object](#7-failure-analysis-object). |
| `timestamp` | string | ISO 8601 UTC timestamp of when the benchmark completed. |

**Status definitions:**
- `success` — benchmark ran and produced a valid score that improved or held even vs baseline
- `regression` — benchmark ran but score dropped below baseline
- `error` — benchmark could not be run due to a code or environment error
- `timeout` — benchmark run exceeded the allowed time limit

### Example

```json
{
  "executor_id": "executor_1",
  "plan_id": "round_1_planner_a",
  "benchmark_score": 85.2,
  "benchmark_raw": "{\"primary\": 85.2, \"sub_scores\": {\"detailed_score_a\": 85.2, \"detailed_score_b\": 42.3, \"detailed_score_c\": 512}}",
  "status": "success",
  "sub_scores": {
    "detailed_score_a": 85.2,
    "detailed_score_b": 42.3,
    "detailed_score_c": 512
  },
  "failure_analysis": null,
  "timestamp": "2026-03-28T10:00:00Z"
}
```

---

## 3. Research Brief

**Producer:** researcher
**Consumer:** planners

A research brief gives planners the context they need to generate high-quality hypotheses. It combines an analysis of the current repo state with a curated list of improvement ideas, each grounded in evidence from the codebase or literature.

### Fields

| Field | Type | Description |
|---|---|---|
| `iteration` | integer | The iteration number this brief was produced for. |
| `researcher_id` | string | Identifier of the researcher agent that produced this brief. |
| `repo_analysis_summary` | string | Concise summary of the current repo state: what the training loop does, what is obviously missing, and what has already been tried. |
| `ideas` | array of objects | Ordered list of improvement ideas, highest confidence first. Each idea is an object with the fields below. |

**Idea object fields:**

| Field | Type | Description |
|---|---|---|
| `title` | string | Short, descriptive name for the idea. |
| `source` | string | Where the idea came from: repo issues, papers, past iterations, empirical knowledge. Be specific. |
| `evidence` | string | Concrete evidence supporting the idea. Reference specific code locations, numbers, or citations. |
| `approach_family` | string | Structured tag from the [Approach Family Taxonomy](#6-approach-family-taxonomy). |
| `confidence` | string | One of: `high`, `medium`, `low`. Reflects how likely the idea is to produce improvement given the evidence. |
| `estimated_impact` | string | Human-readable estimate of expected gain, e.g. `"3-5%"` or `"unknown"`. |

### Example

```json
{
  "iteration": 1,
  "researcher_id": "researcher_1",
  "repo_analysis_summary": "PyTorch training pipeline, no LR scheduling, basic SGD optimizer",
  "ideas": [
    {
      "title": "Learning Rate Warmup with Cosine Decay",
      "source": "repo issues #34 + Attention Is All You Need paper",
      "evidence": "Current repo uses constant LR, papers show 3-5% improvement with warmup",
      "approach_family": "training_config",
      "confidence": "high",
      "estimated_impact": "3-5%"
    }
  ]
}
```

---

## 4. Iteration History Record

**Producer:** orchestrator
**Consumer:** planners, researcher

After each iteration the orchestrator writes one history record capturing what was tried, what won, what lost, and the lessons learned. Planners and the researcher read the full history before each new round to avoid redundant experiments and to build on prior wins.

### Fields

| Field | Type | Description |
|---|---|---|
| `iteration` | integer | The iteration number this record describes. |
| `baseline_score` | number | Benchmark score at the start of this iteration, before any changes were applied. |
| `winner` | object or null | The plan that produced the best score this iteration, or `null` if no winner. See winner object fields below. |
| `losers` | array of objects | All plans that did not win this iteration, including regressions and errors. See loser object fields below. |
| `research_brief_id` | string | Identifier linking this record to the research brief that informed the round. Format: `round_{N}`. |

**Winner object fields:**

| Field | Type | Description |
|---|---|---|
| `plan_id` | string | The winning plan's identifier. |
| `score` | number | Benchmark score achieved by this plan. |
| `approach_family` | string | Approach family tag from the winning plan. |
| `hypothesis` | string | The hypothesis that was confirmed. |
| `sub_scores` | object or null | Sub-score dimensions from the winning executor's benchmark output. `null` if not available. |

**Loser object fields:**

| Field | Type | Description |
|---|---|---|
| `plan_id` | string | The losing plan's identifier. |
| `score` | number | Benchmark score achieved (may be lower than baseline). |
| `approach_family` | string | Approach family tag from the losing plan. |
| `hypothesis` | string | The hypothesis that was refuted or failed to confirm. |
| `sub_scores` | object or null | Sub-score dimensions from this executor's benchmark output. `null` if not available. |
| `failure_analysis` | object | A [Failure Analysis Object](#7-failure-analysis-object) with structured breakdown of why this plan lost. |

### Example

```json
{
  "iteration": 1,
  "baseline_score": 80.0,
  "winner": {
    "plan_id": "round_1_planner_a",
    "score": 85.2,
    "approach_family": "training_config",
    "hypothesis": "AdamW optimizer improves convergence",
    "sub_scores": {"detailed_score_a": 85.2, "detailed_score_b": 42.3}
  },
  "losers": [
    {
      "plan_id": "round_1_planner_b",
      "score": 78.5,
      "approach_family": "architecture",
      "hypothesis": "Add dropout for regularization",
      "sub_scores": {"detailed_score_a": 78.5, "detailed_score_b": 55.1},
      "failure_analysis": {
        "what": "Score dropped from 80.0 to 78.5",
        "why": "Dropout caused underfitting on small dataset — regularization counterproductive",
        "category": "regression",
        "lesson": "Don't add regularization when training data is limited"
      }
    }
  ],
  "research_brief_id": "round_1"
}
```

---

## 5. Visualization Data

**Producer:** orchestrator
**Consumer:** `plot_progress.py`

The visualization data file is a top-level JSON array of flat entries. The orchestrator appends entries after each iteration. `plot_progress.py` reads the entire array to render the progress chart.

### Structure

The file contains a JSON array. Each element represents one candidate from one iteration:

| Field | Type | Description |
|---|---|---|
| `iteration` | integer | The iteration number. |
| `plan_id` | string | The plan's identifier. |
| `benchmark_score` | number | Benchmark score achieved. |
| `is_winner` | boolean | `true` if this candidate won the tournament. |
| `approach_family` | string | Approach family tag. |
| `sub_scores` | object or null | Sub-score dimensions from this candidate's benchmark output. `null` if not available. |

### Example

```json
[
  { "iteration": 1, "plan_id": "round_1_planner_a", "benchmark_score": 85.2, "is_winner": true, "approach_family": "training_config", "sub_scores": {"detailed_score_a": 85.2, "detailed_score_b": 42.3} },
  { "iteration": 1, "plan_id": "round_1_planner_b", "benchmark_score": 78.5, "is_winner": false, "approach_family": "architecture", "sub_scores": {"detailed_score_a": 78.5, "detailed_score_b": 55.1} }
]
```

> **Append, do not overwrite.** Each iteration the orchestrator reads the existing array, appends new entries (one per candidate), and writes the full array back. Never replace the entire file.

---

## 6. Approach Family Taxonomy

The `approach_family` field appears in plan documents, benchmark results, research briefs, iteration history records, and visualization data. All agents must use the same set of values to enable deduplication and cross-iteration analysis.

### Predefined Families

| Tag | Description |
|---|---|
| `architecture` | Changes to model structure: layers, activations, normalization, connections. |
| `training_config` | Changes to the training loop: optimizer, learning rate, scheduler, batch size, epochs. |
| `data` | Changes to data loading, augmentation, preprocessing, or dataset composition. |
| `infrastructure` | Changes to hardware utilization, distributed training, mixed precision, checkpointing. |
| `optimization` | Numerical or algorithmic optimizations that do not change model architecture or training config. |
| `testing` | Changes to evaluation methodology, metrics, or test harness. |
| `documentation` | Documentation-only changes with no effect on benchmark score. |
| `other` | Anything that does not fit the above categories. Use sparingly. |

### Extensibility

Custom families can be registered in `harness.md` under a `## Custom Approach Families` section. Any value defined there is valid. Unrecognized values that are not in `harness.md` must be rejected by the critic.

---

## 7. Failure Analysis Object

**Used in:** Benchmark Result (`failure_analysis` field), Iteration History Record (loser `failure_analysis` field)

When a plan execution produces a non-`success` status, the executor must populate a structured failure analysis. This object feeds directly into lessons-learned for future planners and the researcher.

### Fields

| Field | Type | Description |
|---|---|---|
| `what` | string | Factual description of what went wrong, including before/after scores or error messages where relevant. |
| `why` | string | Root cause explanation. Should identify the mechanism of failure, not just restate the symptom. |
| `category` | string | One of the predefined failure categories below. |
| `lesson` | string | Actionable lesson distilled from this failure. Written for future planners to act on directly. |

### Failure Categories

| Category | When to use |
|---|---|
| `oom` | Execution ran out of memory. |
| `timeout` | Execution exceeded the allowed time limit. |
| `regression` | Benchmark score dropped below baseline. |
| `logic_error` | Code change introduced a bug or incorrect behavior. |
| `scope_error` | Executor modified files outside of `target_files`. |
| `infrastructure` | Failure caused by environment, dependencies, or system issues unrelated to the plan itself. |
| `benchmark_parse_error` | The benchmark output could not be parsed into a numeric score. |
| `sealed_file_violation` | Executor attempted to modify a file marked as sealed in `harness.md`. |

### Example

```json
{
  "what": "Benchmark score dropped from 80.0 to 75.3",
  "why": "Dropout layer caused underfitting on small dataset",
  "category": "regression",
  "lesson": "Regularization is counterproductive when training data is limited"
}
```

---

## 8. Iteration State

**Producer:** orchestrator
**Consumer:** orchestrator (on resume)

Tracks the progress of a single iteration for robust resumability. The orchestrator updates this file at each step transition so that if the session terminates, it can resume from the exact point of interruption.

**File location:** `docs/agent_defined/iteration_state.json`

### Fields

| Field | Type | Description |
|---|---|---|
| `iteration` | integer | The iteration number currently in progress. |
| `status` | string | One of: `in_progress`, `completed`, `failed`, `interrupted`. |
| `current_step` | string | One of: `pre_loop_validation`, `user_ideas`, `research`, `planning`, `critic_review`, `execution`, `tournament`, `recording`, `visualization`, `cleanup`, `stop_check`. |
| `started_at` | string | ISO 8601 timestamp of when this iteration began. |
| `updated_at` | string | ISO 8601 timestamp of last state update. |
| `research` | object | Status of the research step. Fields: `status` (pending/in_progress/completed/failed/skipped), `output_path` (string or null), `completed_at` (string or null). |
| `planning` | object | Status of the planning step. Fields: `status`, `plans` (object mapping planner_id to `{status, output_path, critic_approved}`), `approved_count` (integer), `completed_at` (string or null). |
| `execution` | object | Status of the execution step. Fields: `status`, `executors` (object mapping executor_id to `{status, plan_id, output_path, benchmark_score}`), `completed_at` (string or null). |
| `tournament` | object | Status of the tournament step. Fields: `status`, `winner` (string or null — executor_id), `winner_score` (number or null), `completed_at` (string or null). |
| `recording` | object | Status of the recording step. Fields: `status`, `history_path` (string or null), `visualization_updated` (boolean), `cleanup_done` (boolean). |
| `user_ideas_consumed` | array of strings | List of user idea titles consumed in this iteration. |

### Example

```json
{
  "iteration": 1,
  "status": "in_progress",
  "current_step": "execution",
  "started_at": "2026-03-28T10:00:00Z",
  "updated_at": "2026-03-28T10:15:00Z",
  "research": {
    "status": "completed",
    "output_path": "docs/agent_defined/research_briefs/round_1.json",
    "completed_at": "2026-03-28T10:05:00Z"
  },
  "planning": {
    "status": "completed",
    "plans": {
      "planner_a": { "status": "completed", "output_path": "docs/plans/round_1/plan_planner_a.json", "critic_approved": true },
      "planner_b": { "status": "completed", "output_path": "docs/plans/round_1/plan_planner_b.json", "critic_approved": true },
      "planner_c": { "status": "completed", "output_path": "docs/plans/round_1/plan_planner_c.json", "critic_approved": false }
    },
    "approved_count": 2,
    "completed_at": "2026-03-28T10:10:00Z"
  },
  "execution": {
    "status": "in_progress",
    "executors": {
      "executor_1": { "status": "running", "plan_id": "round_1_planner_a", "output_path": null, "benchmark_score": null },
      "executor_2": { "status": "pending", "plan_id": "round_1_planner_b", "output_path": null, "benchmark_score": null }
    },
    "completed_at": null
  },
  "tournament": {
    "status": "pending",
    "winner": null,
    "winner_score": null,
    "completed_at": null
  },
  "recording": {
    "status": "pending",
    "history_path": null,
    "visualization_updated": false,
    "cleanup_done": false
  },
  "user_ideas_consumed": []
}
```

---

## 9. Merge Report

**Producer:** github_manager
**Consumer:** orchestrator

After each tournament, the github_manager produces a merge report summarizing the outcome. The orchestrator reads this to update counters and record iteration history.

**File location:** `docs/agent_defined/merge_reports/round_{n}.json`

### Fields

| Field | Type | Description |
|---|---|---|
| `iteration` | integer | The iteration number this report describes. |
| `goal_slug` | string | Short identifier for the improvement goal. |
| `winner` | object or null | The winning executor's details, or `null` if no winner. See winner fields below. |
| `archived` | array of strings | List of archive tag names created for losing branches. Format: `archive/round_{n}_executor_{id}`. |
| `regressions_detected` | boolean | Whether any re-benchmark regression was detected during the tournament. |
| `re_benchmark_score` | number or null | The re-benchmark score on the merged improvement branch. `null` if no winner. |
| `status` | string | One of: `merged`, `no_improvement`, `no_winner`, `all_rejected`. |
| `reason` | string or null | Explanation when status is not `merged`. `null` when status is `merged`. |

**Winner object fields:**

| Field | Type | Description |
|---|---|---|
| `executor_id` | string | The winning executor's identifier. |
| `branch` | string | The experiment branch that was merged. Format: `experiment/round_{n}_executor_{id}`. |
| `hypothesis` | string | The hypothesis from the winning plan. |
| `score_before` | number | Benchmark score before the merge (on `improve/{goal_slug}`). |
| `score_after` | number | Benchmark score after the merge (from executor's result). |
| `sub_scores` | object or null | Sub-score dimensions from the winning executor's benchmark output. `null` if not available. |

### Example

```json
{
  "iteration": 3,
  "goal_slug": "reduce_latency",
  "winner": {
    "executor_id": "executor_2",
    "branch": "experiment/round_3_executor_2",
    "hypothesis": "Cache intermediate results in the hot path",
    "score_before": 142.3,
    "score_after": 118.7,
    "sub_scores": {
      "detailed_score_a": 85.2,
      "detailed_score_b": 118.7,
      "detailed_score_c": 256
    }
  },
  "archived": [
    "archive/round_3_executor_1",
    "archive/round_3_executor_3"
  ],
  "regressions_detected": false,
  "re_benchmark_score": 118.7,
  "status": "merged",
  "reason": null
}
```

---

## 10. Plan Archive

**Producer:** orchestrator (Step 9f)
**Consumer:** researchers, planners, humans

Plan documents are archived after each iteration for persistent cross-session access. This ensures that the full history of what was proposed (not just what won or lost) survives across sessions and can be reviewed later.

**Location:** `docs/agent_defined/plan_archive/round_{n}/`

**Contents:** Exact copies of all plan JSON files from `docs/plans/round_{n}/`, including critic reviews and architect reviews. Files are copied, not moved — `docs/plans/` remains the active working directory for the current session.

**Naming:** `plan_planner_{id}.json` (same as source)

**Retention:** Permanent. Plan archives are never deleted automatically. They provide a complete record of every hypothesis considered across all iterations, complementing the iteration history records which only capture outcomes.

---

## 11. Event Log

**Producer:** orchestrator
**Consumer:** visualization (Phase 2), humans

The event log tracks significant state changes in the self-improvement loop: configuration changes, phase transitions, and other notable events. Events are stored as an append-only array. The orchestrator appends new events whenever a tracked setting changes or a goal phase transition occurs.

**File location:** `tracking_history/events.json`

### Fields

| Field | Type | Description |
|---|---|---|
| `timestamp` | string | ISO 8601 UTC timestamp of when the event occurred. |
| `event_type` | string | One of: `config_change`, `phase_transition`. |
| `iteration` | integer or null | The iteration number when this event occurred. `null` for events outside the loop (e.g., during setup). |
| `details` | object | Event-specific payload. Structure depends on `event_type`. |

**`config_change` details:**

| Field | Type | Description |
|---|---|---|
| `field` | string | The setting field that changed (e.g., `benchmark_command`, `number_of_agents`, `target_value`, `sealed_files`). |
| `old_value` | any | The previous value. |
| `new_value` | any | The new value. |
| `source` | string | Where the change originated: `user` (manual edit) or `system` (automated). |

**`phase_transition` details:**

| Field | Type | Description |
|---|---|---|
| `from_phase` | string or null | The phase being exited. `null` if this is the first phase. |
| `to_phase` | string | The phase being entered. |
| `reason` | string | Why the transition occurred (e.g., "all phase targets met", "user-initiated"). |

### Example

```json
[
  {
    "timestamp": "2026-03-28T10:00:00Z",
    "event_type": "config_change",
    "iteration": 5,
    "details": {
      "field": "number_of_agents",
      "old_value": 2,
      "new_value": 3,
      "source": "user"
    }
  },
  {
    "timestamp": "2026-03-28T14:00:00Z",
    "event_type": "phase_transition",
    "iteration": 12,
    "details": {
      "from_phase": "phase_1",
      "to_phase": "phase_2",
      "reason": "all phase 1 sub-score targets met"
    }
  }
]
```

---

## 12. Goal Phase

**Defined in:** `docs/user_defined/goal.md`
**Tracked in:** `docs/agent_defined/settings.json` (`current_phase` field)

Goal phases are named stages in the improvement goal, each with specific sub-score targets. Phases organize the improvement journey into sequential milestones focused on different dimensions. Phase transitions are user-controlled and logged as events.

### Phase Definition (in goal.md)

Each phase is defined within the `## Phases` section of `goal.md`:

| Field | Type | Description |
|---|---|---|
| `name` | string | Short identifier for the phase (e.g., `phase_1`, `phase_2`). |
| `description` | string | What this phase focuses on. |
| `targets` | object | Dictionary mapping sub-score names to target values. The primary score target is defined separately in the main goal section. |
| `status` | string | One of: `active`, `completed`, `pending`. Only one phase can be `active` at a time. |

### Phase Tracking (in agent settings.json)

| Field | Type | Description |
|---|---|---|
| `current_phase` | string or null | Name of the currently active phase from `goal.md`. `null` if phases are not configured. |

### Example (goal.md phases section)

```markdown
## Phases

| Phase | Focus | Sub-Score Targets | Status |
|-------|-------|-------------------|--------|
| phase_1 | Improve primary dimension | detailed_score_a >= 90.0 | active |
| phase_2 | Optimize secondary dimension | detailed_score_b <= 50.0, detailed_score_a >= 90.0 | pending |
| phase_3 | Balance all dimensions | detailed_score_c <= 256, detailed_score_b <= 50.0, detailed_score_a >= 90.0 | pending |
```

Phase transitions do not affect tournament selection — the primary `benchmark_score` always drives winner selection. Phases provide tracking and strategic guidance only.

---

## 13. Teammate Registry

**Producer:** orchestrator
**Consumer:** orchestrator (on resume), team manager

Tracks all active and historical planner teammates. Written whenever a teammate is created, killed, or transitions state. On resume, used to determine which teammates are alive and whether a continuation planner exists.

**File location:** `docs/agent_defined/teammate_registry.json`

### Fields

| Field | Type | Description |
|---|---|---|
| `teammates` | array of objects | All teammate entries, past and present. |
| `updated_at` | string or null | ISO 8601 timestamp of the last write. `null` in the initial empty file. |
| `teammates[].teammate_id` | string | Unique identifier. Format: `{role}_{round}` (e.g., `continuation_planner_3`). |
| `teammates[].role` | string | One of: `continuation_planner`, `challenger_b`, `challenger_c`. |
| `teammates[].created_at` | string | ISO 8601 timestamp of creation. |
| `teammates[].round` | integer | Round in which this teammate was first activated. |
| `teammates[].status` | string | One of: `active`, `dead`, `idle`. |
| `teammates[].streak` | integer | Consecutive wins. `0` for challengers and newly created continuation planners. |

### Example

```json
{
  "teammates": [
    {
      "teammate_id": "continuation_planner_3",
      "role": "continuation_planner",
      "created_at": "2026-03-28T14:00:00Z",
      "round": 3,
      "status": "active",
      "streak": 1
    }
  ],
  "updated_at": "2026-03-28T14:00:00Z"
}
```

---

## 14. Continuation Planner Notebook

**Producer:** continuation planner
**Consumer:** continuation planner (on next round), hybrid planner (if enabled)

Persistent memory read at round start and updated after win/loss feedback. Challengers never read it. On rotation the old notebook is archived and the new planner starts fresh.

**File location:** `docs/agent_defined/notebook.json` — archived to `docs/agent_defined/notebooks/round_{N}.json` on rotation.

### Fields

| Field | Type | Description |
|---|---|---|
| `planner_id` | string or null | Identifier of the planner holding this notebook. `null` before any winner exists. |
| `rounds_active` | array of integers | Rounds in which this planner was active as continuation planner. |
| `streak` | integer | Current consecutive-win count. Mirrors `streak` in teammate registry. |
| `observations` | array of objects | Per-round observations. Each has: `round` (int), `what_worked` (str), `what_surprised` (str), `next_idea` (str), `executor_feedback` (str). |
| `dead_ends` | array of strings | Approaches proven not to work. Prevents re-proposing exhausted directions. |
| `current_theory` | string or null | Working hypothesis about the bottleneck. Updated each round. `null` until first observation. |

### Example

```json
{
  "planner_id": "continuation_planner_3",
  "rounds_active": [3, 4],
  "streak": 1,
  "observations": [
    { "round": 3, "what_worked": "Caching hot path reduced latency by 12%", "what_surprised": "Memory usage did not increase as expected", "next_idea": "Try connection pooling", "executor_feedback": "No file conflicts" }
  ],
  "dead_ends": ["Async refactor of module X — no measurable improvement"],
  "current_theory": "Bottleneck is I/O bound. Changes that reduce round-trips are working."
}
```

---

## 15. Findings Entry

**Producer:** orchestrator (after each executor completes)
**Consumer:** Researcher-Fail (all findings including mid-round), continuation planner and challengers (completed-round only)

Published immediately after each executor completes, even mid-round. **File location:** `docs/agent_defined/findings/round_{N}_executor_{id}.json`

| Field | Type | Description |
|---|---|---|
| `round` | integer | Round in which this executor ran. |
| `plan_id` | string | Links finding back to the executed plan. |
| `hypothesis` | string | Hypothesis copied verbatim for quick scanning. |
| `score` | number | Benchmark score produced. |
| `status` | string | One of: `success`, `regression`, `error`, `timeout`. Same as [Benchmark Result](#2-benchmark-result). |
| `quick_observation` | string | One-sentence observation; seeds Researcher-Fail. |
| `timestamp` | string | ISO 8601 timestamp. |

```json
{ "round": 4, "plan_id": "round_4_planner_b", "hypothesis": "Connection pooling reduces round-trip overhead", "score": 91.3, "status": "success", "quick_observation": "Helped only with >100 concurrent requests", "timestamp": "2026-03-28T15:30:00Z" }
```

---

## 16. Retrospection Signal

**Producer:** orchestrator (Step 9½)
**Consumer:** orchestrator (same step — drives next-round configuration)

In-memory dispatch object. Not persisted to disk; effects are reflected in settings, teammate state, and research brief directives. Fields: `signal` (string), `detected_at_round` (integer), `data` (object — signal-specific payload, see table), `actions` (array of strings).

### Signal Triggers and Actions

| Signal | Trigger | `data` fields | Actions |
|---|---|---|---|
| `plateau` | `plateau_consecutive_count` >= `plateau_window` | `consecutive_count` (int), `threshold` (num), `reshaped` (bool) | Force-rotate continuation planner; elevate Researcher-Fail; inject diversity directive. If `reshaped=true` and plateau persists, stop. |
| `high_failure_rate` | >  `failure_rate_threshold_pct`% plans rejected or failed | _(none)_ | Spawn meta-researcher; feed findings to next round's planners as highest-priority brief. |
| `family_concentration` | Same family won 2+ of last `family_concentration_window` rounds | `concentrated_family` (str), `window_wins` (int) | Forbid that family for challengers; inject Researcher-Ext directive to search outside it. |
| `near_miss` | Losing executor scored within `near_miss_threshold_pct`% of winner | `near_miss_plan_id` (str), `near_miss_score` (num), `winner_score` (num), `gap_pct` (num) | Promote near-miss as research seed for one challenger next round. |

### Example

```json
{
  "signal": "near_miss",
  "detected_at_round": 5,
  "data": { "near_miss_plan_id": "round_5_planner_c", "near_miss_score": 87.9, "winner_score": 89.2, "gap_pct": 1.46 },
  "actions": ["Inject near-miss seed into challenger_b for round 6: refine round_5_planner_c approach"]
}
```

---

## 17. Hybrid Plan Metadata

**Extension of:** [Plan Document](#1-plan-document) (`hybrid_metadata` field)
**Producer:** hybrid planner
**Consumer:** critic (redundancy check), orchestrator (tournament, winner handoff)

Extension field added to the standard plan document by the hybrid planner. Required on hybrid plans; absent on all others. Rejected by critic if >  `redundancy_threshold_pct`% similar to any single source plan.

| Field | Type | Description |
|---|---|---|
| `hybrid_metadata` | object or null | `null` on non-hybrid plans. |
| `hybrid_metadata.source_plans` | array of strings | `plan_id` values synthesized from. Minimum 2 entries. |
| `hybrid_metadata.synthesis_strategy` | string | One of: `combine` (compound related areas), `refine` (rewrite execution with cross-plan insight), `contrast` (resolve a tension). |
| `hybrid_metadata.rationale` | string | Why this synthesis is stronger than any individual source plan. |

```json
{
  "plan_id": "round_4_hybrid",
  "planner_id": "hybrid",
  "hybrid_metadata": {
    "source_plans": ["round_4_planner_cont", "round_4_planner_b"],
    "synthesis_strategy": "combine",
    "rationale": "Planner-cont proposed caching; planner-b proposed connection pooling. Combined, they eliminate redundant calls and reduce per-call cost."
  }
}
```

---

## 18. De-Risk Result

**Producer:** de-risk validator (Step 7c)
**Consumer:** orchestrator (gates full execution), Researcher-Fail (failed de-risk feeds failure analysis)

Lightweight smoke test outcome per critic-approved plan. A failed de-risk excludes the plan from Step 8. **File location:** `docs/agent_defined/findings/derisk_round_{N}_plan_{plan_id}.json`

| Field | Type | Description |
|---|---|---|
| `plan_id` | string | The plan that was de-risked. |
| `round` | integer | Round number. |
| `passed` | boolean | `true` if smoke test passed and full execution may proceed. |
| `status` | string | One of: `passed`, `compile_error` (syntax/import failure), `start_error` (benchmark failed to start), `smoke_timeout` (exceeded timeout), `smoke_regression` (reduced-dataset run regressed). |
| `step_applied` | integer | Plan step applied (always `1`). |
| `duration_seconds` | number | Wall-clock seconds taken. |
| `error_detail` | string or null | `null` on `passed`. Error message or regression magnitude on failure. |
| `timestamp` | string | ISO 8601 timestamp. |

```json
{ "plan_id": "round_4_planner_b", "round": 4, "passed": false, "status": "compile_error", "step_applied": 1, "duration_seconds": 3.2, "error_detail": "ImportError: No module named 'connection_pool' at src/db.py line 12", "timestamp": "2026-03-28T15:00:00Z" }
```
