# Self-Improvement Loop

An AI agent orchestration system that iteratively improves any GitHub repository using a tournament selection model.

## What This Does

You give it a repo and a goal. It spawns multiple AI agents that independently propose and test improvements. The best result wins and merges. Repeat until the goal is met.

## Setup

1. Clone a target repo into `want_to_improve/`
2. Put your evaluation script in `benchmark_is_here/`
3. Define your goal in `docs/user_defined/goal.md`
4. Configure guardrails in `docs/user_defined/harness.md`
5. Run the orchestrator

## Architecture

```
CLAUDE.md (entry point)
  └── orchestrator (loop controller)
        ├── researcher         — analyzes codebase, finds improvement opportunities
        ├── planner (×N)       — generates improvement hypotheses
        │     ├── plan-creator     — structures plan documents
        │     ├── plan-architect   — reviews architectural soundness
        │     └── plan-critic      — enforces harness rules
        ├── executor (×N)      — implements plans in isolated worktrees
        └── github-manager     — picks winner, merges, records history
```

Each iteration:
1. **Research** — analyze the repo and past results
2. **Plan** — N agents each propose a different improvement hypothesis
3. **Review** — architect and critic validate each plan
4. **Execute** — approved plans run in parallel, each in its own worktree
5. **Select** — benchmark all results, best one merges (tournament selection)
6. **Record** — every result (win or lose) becomes institutional memory
7. **Repeat** — until the goal is reached or a plateau is detected

## Project Structure

```
CLAUDE.md                   # Entry point
agents/
  orchestrator/             # Loop controller
  researcher/               # Codebase analysis
  planner/                  # Hypothesis generation
    skills/                 # Plan sub-skills (creator, architect, critic)
  executor/                 # Experiment runner
  github_manager/           # Branch management and merge
docs/
  user_defined/             # Your config: goal, harness, settings
  agent_defined/            # Agent output: iteration history, research briefs
  theory/                   # Design docs, data contracts
  plans/                    # Per-round improvement plans
scripts/
  validate.sh               # Sealed evaluation runner
  plot_progress.py          # Progress visualization
benchmark_is_here/          # Your evaluation code (read-only to agents)
tracking_history/           # Raw benchmark data across iterations
```

## Key Concepts

- **Tournament Selection** — N parallel experiments per iteration, single winner merges
- **Institutional Memory** — every result (win or lose) is recorded for future planning
- **Harness Rules** — one hypothesis per plan, no repeating the same approach family 3x, diversity within each round
- **Sealed Evaluation** — benchmark code is read-only so agents cannot game the metric
- **Plateau Detection** — auto-stops when no improvement is found after configured rounds

## License

MIT
