---
name: si-plan-creator
description: Create a plan document with one testable hypothesis following data contract schema. Internal planner sub-skill.
tools: Read, Grep, Glob, Write
---

# Plan Creator Skill

## Role

Plan creation skill for the code improvement domain. Produces one plan document per invocation — exactly one hypothesis, one approach, one testable outcome.

## Invocation

This skill is called by the si-planner skill to formalize a plan into the structured JSON format required by the pipeline.

## Rules

### One hypothesis per plan

Test exactly one idea. If you find yourself writing "and also" or listing two changes that address different hypotheses, split them. The critic will reject plans with multiple independent hypotheses.

### Structured JSON output

Output must match the Plan Document schema from `docs/theory/data_contracts.md`. Required fields:

- `plan_id` — unique identifier: `round_{n}_planner_{id}`
- `planner_id` — which planner produced this: `planner_a`, `planner_b`, or `planner_c`
- `round` — current round number (integer)
- `hypothesis` — single sentence: "Doing X should improve Y because Z"
- `approach_family` — from the approved taxonomy (see below)
- `critic_approved` — always `false` when first written; critic sets this
- `target_files` — list of files to be changed
- `steps` — ordered list of concrete changes
- `expected_outcome` — metric, estimated impact, rationale
- `history_reference` — what this builds on and what it avoids

### Approach family taxonomy

Tag every plan with exactly one value from this list:

| Value | Meaning |
|-------|---------|
| `architecture` | Structural changes to how components are organized or interact |
| `training_config` | Changes to hyperparameters, schedules, or training setup |
| `data` | Changes to data preprocessing, augmentation, or sourcing |
| `infrastructure` | Changes to build, deployment, or environment configuration |
| `optimization` | Algorithmic or runtime performance improvements |
| `testing` | Changes to evaluation methodology or test coverage |
| `documentation` | Changes to documentation or specification only |
| `other` | Does not fit any above category — explain in the plan |

### Concrete steps

Steps must be specific enough for an executor to implement without asking questions. Bad: "improve the loss function." Good: "In `src/train.py` line 47, replace `nn.CrossEntropyLoss()` with `nn.CrossEntropyLoss(label_smoothing=0.1)`."

Each step entry:
```json
{ "step": <n>, "file": "<path>", "change": "<exact description of what to change and how>" }
```

### Expected outcome

Include a quantified or qualified estimate of impact on the target metric from `goal.md`. Acknowledge uncertainty when evidence is weak. Structure:

```json
{
  "metric": "<name of metric>",
  "estimated_impact": "<e.g. +2-4% accuracy, or 'reduced overfitting based on similar results in ref [X]'>",
  "rationale": "<why this change produces this outcome>"
}
```

### Evidence grounding

Reference the research brief or iteration history to justify the hypothesis. Do not propose changes based on intuition alone. If evidence is weak, say so explicitly in the rationale.
