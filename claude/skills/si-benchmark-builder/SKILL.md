---
name: si-benchmark-builder
description: Analyze a target repository and create a benchmark script that measures the improvement goal. Short interview if approach is unclear, then build, validate, and record baseline.
user-invocable: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
effort: high
---

# Benchmark Builder

## Role

You build a benchmark for the self-improvement loop. The benchmark must produce a single numeric score that the loop can optimize against. You prefer adapting what already exists over building from scratch.

## Prerequisites

Before starting, verify:
- `want_to_improve/` exists and contains a `.git` directory (repo is cloned)
- `si_setting_goal` is `true` in `docs/agent_defined/settings.json` (goal is defined)
- `docs/user_defined/goal.md` is readable and has a defined objective and metric

If goal is not set, stop: "Define the goal first. Run `/si-goal-clarifier`."

If `benchmark_command` is already set and non-empty in `docs/user_defined/settings.json`, ask: "A benchmark is already configured: `{command}`. Do you want to replace it or keep it?" Respect the answer.

## Workflow

### Phase 1 — Understand the Goal

Read `docs/user_defined/goal.md`. Extract:
- Metric name and direction
- Target value
- Scope constraints

### Phase 2 — Repo Survey (silent)

Explore `want_to_improve/` for existing evaluation:

| Look for | Where |
|----------|-------|
| Test suites | `pytest`, `jest`, `go test`, `cargo test`, test directories |
| Benchmark scripts | `benchmark.*`, `eval.*`, `score.*`, `Makefile` targets |
| CI evaluation | `.github/workflows/`, `.gitlab-ci.yml` |
| Performance tests | `perf/`, `bench/`, profiling configs |
| Metrics in code | logging, print statements with scores, accuracy calculations |
| Build requirements | `requirements.txt`, `package.json`, `Makefile`, setup scripts |

Classify what you find:

- **Ready to use**: existing script that already outputs the target metric → adapt it
- **Partially usable**: tests exist but don't output a single score → wrap them
- **Nothing exists**: no evaluation at all → build from scratch

Also check if the repo needs build/install steps before the benchmark can run (e.g., `pip install`, `npm install`, `make build`). If so, include these in the benchmark command.

### Phase 3 — Interview (only if needed)

If the approach is clear from Phase 1+2, skip to Phase 4.

If unclear, ask **up to 3 questions** to resolve ambiguity. Examples:
- "The repo has both unit tests and integration tests. Should the benchmark measure pass rate of both, or just integration?"
- "I found a `evaluate.py` that outputs accuracy and F1 score. Which metric should be primary?"
- "There's no obvious way to score this repo numerically. Would test pass rate, code complexity score, or execution speed be most relevant to your goal?"

**Hard cap: 3 questions.** This is a builder, not an interview. Get just enough clarity to build.

### Phase 4 — Design

Design the benchmark with these requirements:

| Requirement | Detail |
|-------------|--------|
| **Single numeric output** | One number printed to stdout as the last line |
| **Deterministic** | Same code → same score (within tolerance). Use fixed seeds, disable randomness where possible. |
| **Fast** | Under 5 minutes ideally. If the natural evaluation is slow, sample or subset. |
| **Self-contained** | No external services, no network calls, no credentials needed |
| **Honest** | Measures actual quality, not a proxy that can be gamed |

Output format — the benchmark must print the numeric score as the **last line of stdout**. Just the number, nothing else on that line. Example:
```
Running tests...
Passed 45/50
90.0
```

This is the format the executor parses. Any other stdout is ignored — only the last line matters.

### Phase 5 — Implement

Build the benchmark. Placement priority:
1. If wrapping an existing script: create a thin wrapper next to it
2. If the repo has `scripts/`: `want_to_improve/scripts/benchmark.py`
3. Otherwise: `want_to_improve/benchmark.py`

The script must:
- Exit 0 on success, non-zero on error
- Print the numeric score as the last stdout line
- Handle missing dependencies gracefully (clear error message)
- Include a comment header explaining what it measures and how
- Include build/install steps if needed (or document them in the command)

### Phase 6 — Validate

Run the benchmark 3 times and check:

```
Run 1: {x}
Run 2: {y}
Run 3: {z}
Variance: {(max-min)/mean * 100}%
```

- All 3 must complete without error
- Variance must be acceptable: `(max - min) / mean < 0.05` (5% tolerance)
- If variance is too high: add averaging, fix seeds, or investigate flakiness
- If flakiness cannot be fixed: proceed with a warning, document the variance

Report to user:
```
=== Benchmark Validated ===
Score: {mean} (variance: {variance}%)
Runtime: ~{seconds}s
Command: {command}
```

### Phase 7 — Record and Configure

Update `docs/user_defined/settings.json` (use Edit to preserve existing keys):
- `benchmark_command`: the shell command to run (relative to `want_to_improve/`)
- `benchmark_format`: `"number"` or `"pass_fail"` based on what the benchmark produces

**Add the benchmark script path to `sealed_files`** in `docs/user_defined/settings.json`. This prevents the improvement loop from modifying the benchmark itself.

Record baseline to `tracking_history/baseline.json`:
```json
{ "baseline_score": <mean_score>, "recorded_at": "<ISO 8601>" }
```

Update `docs/agent_defined/settings.json` (use Edit):
- Set `si_setting_benchmark` → `true`
- Set `best_score` → `<mean_score>`

### Phase 8 — Handoff

Print next step:
- If harness is set (`si_setting_harness` is true): "Benchmark ready. All gates passed — start the loop."
- If harness not set: "Benchmark ready. Confirm harness rules to complete setup."

## Benchmark Patterns Reference

| Repo type | Detection | Benchmark approach |
|-----------|-----------|-------------------|
| **ML/AI training** | `torch`, `tensorflow`, `keras` in deps | Run eval on validation set, report accuracy/loss |
| **Library/SDK** | `pytest`, `jest`, test directories | Run test suite, report pass rate: `passed / total * 100` |
| **Web app** | `express`, `flask`, `next` in deps | Run tests + response time checks, composite score |
| **CLI tool** | Binary entry point, arg parsing | Time a standard workload, report speed score |
| **Algorithm code** | Pure functions, no framework | Run on test cases, score = correctness weighted by speed |
| **Data pipeline** | Data processing, ETL patterns | Process sample data, score = throughput or accuracy |

## Error Handling

| Situation | Action |
|-----------|--------|
| Goal is not defined | Stop. Tell user to run `/si-goal-clarifier` first. |
| Repo needs build steps | Include them in the benchmark command or as a setup step in the script. |
| Benchmark produces inconsistent results | Add averaging over N runs. Note the variance. If unfixable, proceed with warning. |
| Benchmark takes too long | Simplify: use a subset of tests, reduce dataset size, or sample. |
| Benchmark script creation fails | Clean up any partial files. Report what went wrong. |
| Pre-existing benchmark | Ask user whether to replace or keep. |

## Constraints

- **Never modify sealed files** from `docs/user_defined/settings.json`
- **Always seal the benchmark** — add it to `sealed_files` after creation
- **Prefer wrapping over rewriting** — if tests exist, wrap them; don't replace them
- **Partial updates only** — when writing to settings JSON, update only relevant keys
