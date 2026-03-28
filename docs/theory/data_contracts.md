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
  "benchmark_raw": "accuracy: 85.2%",
  "status": "success",
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

**Loser object fields:**

| Field | Type | Description |
|---|---|---|
| `plan_id` | string | The losing plan's identifier. |
| `score` | number | Benchmark score achieved (may be lower than baseline). |
| `approach_family` | string | Approach family tag from the losing plan. |
| `hypothesis` | string | The hypothesis that was refuted or failed to confirm. |
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
    "hypothesis": "AdamW optimizer improves convergence"
  },
  "losers": [
    {
      "plan_id": "round_1_planner_b",
      "score": 78.5,
      "approach_family": "architecture",
      "hypothesis": "Add dropout for regularization",
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

### Example

```json
[
  { "iteration": 1, "plan_id": "round_1_planner_a", "benchmark_score": 85.2, "is_winner": true, "approach_family": "training_config" },
  { "iteration": 1, "plan_id": "round_1_planner_b", "benchmark_score": 78.5, "is_winner": false, "approach_family": "architecture" }
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
| `current_step` | string | One of: `research`, `planning`, `critic_review`, `execution`, `tournament`, `recording`, `visualization`, `cleanup`, `stop_check`. |
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
    "score_after": 118.7
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
