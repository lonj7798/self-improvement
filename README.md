# Self-Improvement Loop

A general-purpose evolutionary code improvement engine powered by Claude Code. Given any GitHub repository and a measurable goal, it spawns N parallel AI agent pairs that iteratively improve the codebase through a tournament selection model. The loop continues autonomously until the goal is met or a stop condition fires.

## What This Does

You point it at a repository and define a measurable objective (e.g., "improve test pass rate to 95%", "reduce inference latency below 50ms"). The system then:

1. **Researches** the codebase to identify improvement opportunities
2. **Generates** N independent improvement hypotheses in parallel, each with a concrete plan
3. **Executes** each plan in an isolated git worktree so experiments don't interfere
4. **Benchmarks** every change against a sealed evaluation (agents cannot modify the benchmark)
5. **Selects** the best-performing change via tournament and merges it
6. **Records** every result — winners and losers alike — as institutional memory that informs future iterations

The core invariant: **every improvement is benchmarked, every result is recorded, and only the best change advances.**

This runs fully autonomously once started. No human intervention needed between iterations. The system stops when the target is reached, a plateau is detected, the max iteration count is hit, or a circuit breaker fires after repeated failures.

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

- **Tournament Selection** — N parallel experiments per iteration, single winner merges. All candidates benchmark against the same baseline commit, so scores are directly comparable. Ties go to the simpler change.
- **Institutional Memory** — every result (win or lose) is recorded with structured failure analysis. Planners must read the full history before proposing new hypotheses, preventing the system from rediscovering dead ends.
- **One Hypothesis Per Plan** — each plan tests exactly one idea. If the benchmark improves, you know why. If it regresses, you know what to revert. Multi-hypothesis plans are rejected by the critic.
- **Approach Family Taxonomy** — every plan is tagged with a category (architecture, training_config, data, optimization, etc.). The system tracks which families are working and prevents overexploitation of a single family (max 3 consecutive wins from the same family).
- **Harness Rules** — enforced by a critic agent before execution: one hypothesis per plan (H001), no repeating the same approach family 3x (H002), diversity within each round (H003). Custom rules can be added.
- **Sealed Evaluation** — benchmark code is marked read-only via `sealed_files` in settings. `validate.sh` enforces this with both git diff checks and SHA-256 hash verification. Agents cannot game the metric.
- **Research-Driven Planning** — a dedicated researcher agent explores the codebase, checks open issues, searches papers, and produces a ranked research brief before planners start. User-provided ideas in `idea.md` take priority.
- **Plateau Detection** — auto-stops when improvement falls below a threshold for N consecutive iterations.
- **Circuit Breaker** — halts after consecutive no-winner iterations, indicating a systemic problem that needs human review.
- **Resumability** — the system tracks within-iteration progress in `iteration_state.json`. If interrupted at any step, it resumes from exactly where it left off without re-running completed work.

## How It Works (Detailed)

### The Loop

```
while goal not met:
    1. Read goal + history + harness rules
    2. Researcher explores repo → produces research brief
    3. N planners each write 1 plan (1 hypothesis each)
    4. Critic validates each plan against harness rules
    5. N executors run approved plans in parallel (isolated worktrees)
    6. Tournament: best benchmark score wins → merge to improve/ branch
    7. Record everything (winners + losers + lessons)
    8. Update visualization (progress chart)
    9. Check stop conditions
```

### Git Strategy

The system uses a fork-based branch-per-experiment model. All git operations (branches, worktrees, merges) happen inside `want_to_improve/` (the forked repo clone), not in the self-improvement project root.

- **`improve/{goal_slug}`** — accumulation branch. Only winning changes merge here. `git log` shows a clean history of improvements with scores. Pushed to the fork after each winner for backup.
- **`experiment/round_{n}_executor_{id}`** — short-lived branches for each experiment. Created via `git worktree add` for full isolation.
- **`archive/round_{n}_executor_{id}`** — losing branches are tagged before deletion so commits remain reachable.

### Stop Conditions

| Condition | When |
|-----------|------|
| Target reached | `best_score` meets or exceeds `target_value` |
| Plateau | Improvement < `plateau_threshold` for `plateau_window` consecutive iterations |
| Max iterations | `iterations` >= `max_iterations` |
| Circuit breaker | `circuit_breaker_threshold` consecutive iterations with no winner |

### Configuration

All configuration lives in `docs/user_defined/settings.json`:

```json
{
  "number_of_agents": 3,
  "benchmark_command": "python run_eval.py",
  "benchmark_direction": "higher_is_better",
  "max_iterations": 50,
  "plateau_threshold": 0.01,
  "plateau_window": 3,
  "target_value": 95.0,
  "sealed_files": ["benchmark/eval.py"],
  "circuit_breaker_threshold": 3
}
```

## Data Contracts

All inter-agent communication follows strict JSON schemas defined in `docs/theory/data_contracts.md`:

| Schema | Producer | Consumer |
|--------|----------|----------|
| Plan Document | planner | critic, executor |
| Benchmark Result | executor | github-manager |
| Research Brief | researcher | planners |
| Iteration History | orchestrator | planners, researcher |
| Merge Report | github-manager | orchestrator |
| Visualization Data | orchestrator | plot_progress.py |
| Iteration State | orchestrator | orchestrator (resume) |

## Inspired By

- [autoresearch](https://github.com/karpathy/autoresearch) — sealed evaluation + git-as-state-machine
- [Orze](https://github.com/warlockee/orze) — decentralized orchestration + research agent + circuit breaker
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) — multi-agent orchestration layer for Claude Code

## License

MIT
