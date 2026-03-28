# Self-Improvement Loop

An AI agent orchestration system that iteratively improves any GitHub repository using a tournament selection model.

## What This Does

You give it a repo and a goal. It spawns multiple AI agents that independently propose and test improvements. The best result wins and merges. Repeat until the goal is met.

## Setup

1. Clone a target repo into `want_to_improve/`
2. Define your goal in `docs/user_defined/goal.md`
3. Set `benchmark_command` in `docs/user_defined/settings.json`
4. Configure guardrails in `docs/user_defined/harness.md`
5. Run `python3 docs/user_defined/initial_setup.py` (or let the orchestrator walk you through it)

## Architecture

```
CLAUDE.md (loop controller)
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
CLAUDE.md                        # Orchestrator entry point (loop controller)
claude/
  agents/
    si-researcher/               # Codebase analysis + research briefs
    si-planner/                  # Hypothesis generation
      skills/
        si-plan-creator/         # Structures plan documents
        si-plan-architect/       # Reviews architectural soundness
        si-plan-critic/          # Enforces harness rules
    si-executor/                 # Experiment runner in isolated worktrees
    si-github-manager/           # Tournament selection, merge, branch management
  skills/
    si-goal-clarifier/           # Interactive goal definition
    si-benchmark-builder/        # Benchmark creation wizard
docs/
  user_defined/                  # Your config: goal, harness, settings, setup
  agent_defined/                 # Runtime state: iteration history, research briefs
  theory/                        # Design docs, data contracts
scripts/
  validate.sh                    # Sealed file + schema validation
  plot_progress.py               # Progress visualization
want_to_improve/                 # Target repo (cloned during setup)
tracking_history/                # Raw benchmark data + progress chart
```

## Key Concepts

- **Tournament Selection** — N parallel experiments per iteration, single winner merges
- **Institutional Memory** — every result (win or lose) is recorded for future planning
- **Harness Rules** — one hypothesis per plan, no repeating the same approach family 3x, diversity within each round
- **Sealed Evaluation** — benchmark code is read-only so agents cannot game the metric
- **Plateau Detection** — auto-stops when no improvement is found after configured rounds
- **Circuit Breaker** — halts after consecutive no-winner iterations for human review
- **Resumability** — can resume from any point after interruption via iteration state tracking

## Inspired By

- [autoresearch](https://github.com/karpathy/autoresearch) — sealed evaluation + git-as-state-machine
- [Orze](https://github.com/warlockee/orze) — decentralized orchestration + research agent + circuit breaker
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) — multi-agent orchestration layer for Claude Code

## License

MIT
