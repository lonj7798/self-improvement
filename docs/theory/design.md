# Unified Theory: Self-Improvement Loop System

## 1. Overview

This system is a general-purpose evolutionary code improvement engine. Given any GitHub repository and a measurable goal, it spawns N parallel planner+executor agent pairs that iteratively improve the codebase through a tournament selection model. The loop continues until the goal is met or a stop condition fires.

The core invariant: **every improvement is benchmarked, every result is recorded, and only the best change advances.**

Key properties:
- Repository-agnostic: the harness specifies what to measure, not how the code works
- Goal-driven: improvement target defined in `goal.md` by the user
- Parallel exploration: N hypotheses tested simultaneously per iteration
- Sealed evaluation: benchmark code is read-only and cannot be gamed
- Institutional memory: every experiment (win or lose) informs future planners

---

## 2. Tournament Model

Each iteration runs N planner+executor pairs in parallel. At the end, one winner is selected by benchmark score. Only the winner's changes are merged into the main branch.

### Why tournament beats multi-merge

**Multi-merge** (merge all passing candidates) fails in practice because:
- Branches diverge from each other mid-iteration, so fitness scores become incomparable
- Merging multiple branches creates conflicts that require human resolution
- Attribution is lost when multiple changes combine — you cannot tell which improvement came from which hypothesis
- An agent that gets a head start can game the metric before others are evaluated

**Tournament** solves all of this:
- **No stale fitness**: all N candidates are benchmarked against the same baseline commit
- **No merge conflicts**: exactly one branch ever merges; all others are discarded
- **Clear attribution**: one hypothesis per plan, one plan per executor — the winning idea is unambiguous
- **Losers are data**: failed experiments are recorded as institutional memory for future planners, not thrown away

The tournament is purely score-based. The agent with the highest benchmark score that does not introduce a regression wins. Ties go to the simpler change (fewer lines modified).

---

## 3. Evolutionary Search Analogy

The system maps cleanly onto evolutionary algorithm concepts, with honest acknowledgment of its limitations.

| EA Concept | System Equivalent |
|---|---|
| Genotype | Plan (the improvement strategy, written in natural language) |
| Phenotype | Code changes (the diff produced by the executor) |
| Fitness | Benchmark score (deterministic, sealed) |
| Population | N parallel candidates per iteration |
| Selection | Tournament (highest fitness wins) |
| Generation | One iteration of the loop |
| Mutation | Planner generates a new hypothesis from history |

### Honest limitation: no crossover

This is **truncation selection with serial grafting**, not a full genetic algorithm.

- There is no recombination of multiple candidates. The winner's changes are grafted onto the main branch; the losers' approaches are not combined.
- This means the search is essentially guided hill-climbing with parallel restarts, not true evolutionary search.
- First-mover advantage does not apply because only one branch ever merges — all candidates start from the same baseline.

The analogy is useful for framing but should not be overstated. The system explores the hypothesis space in parallel and retains institutional memory across generations, which is the meaningful property.

---

## 4. Sealed Evaluation

Benchmark integrity is enforced mechanically, not by agent discipline.

### How it works

- Benchmark code (evaluation scripts, test harnesses, scoring logic) is designated as read-only via `sealed_files[]` in `settings.json`
- `scripts/validate.sh` runs a deterministic diff check before any benchmark result is accepted
- If any sealed file has been modified, the result is rejected and the executor is penalized
- This check happens outside the agent's execution context — it cannot be bypassed by the agent

### Why this matters

Without sealed evaluation, agents will optimize the metric rather than the underlying capability. This is Goodhart's Law applied to code: once a measure becomes a target, it ceases to be a good measure. Sealing the evaluation scripts prevents this entirely.

### Configuration

```json
// settings.json
{
  "sealed_files": [
    "benchmark/eval.py",
    "benchmark/score.sh",
    "tests/regression/"
  ]
}
```

Users specify which files to seal. At minimum, the evaluation script and any reference data should be sealed. The validate script hashes sealed files before and after execution and rejects any run where hashes differ.

---

## 5. Institutional Memory

Every experiment — win or lose — is a permanent record.

### Storage

All experiment records live in `docs/agent_defined/iteration_history/`. Each iteration produces one file per candidate:

```
docs/agent_defined/iteration_history/
  iter_001_candidate_A.md
  iter_001_candidate_B.md   ← winner
  iter_001_candidate_C.md
  iter_002_candidate_A.md
  ...
```

### Planner obligation

Planners **must** read all prior iteration records before generating a new plan. This is enforced by the critic agent, which rejects plans that propose approaches already documented as failures without explaining why the new attempt will succeed differently.

### Record structure

Each record captures:
- **Hypothesis**: the single idea being tested
- **Approach family**: taxonomy tag (see section 7)
- **Changes made**: summary of the diff
- **Benchmark result**: score achieved vs. baseline
- **Outcome**: win / loss / disqualified
- **Failure analysis** (if applicable): structured root cause (see section 8)
- **Lesson**: one-sentence takeaway for future planners

### Why losers matter

A failed experiment is worth as much as a successful one, sometimes more. It tells future planners:
- What approaches have been exhausted
- Why a plausible-sounding idea did not work in practice
- What constraints (memory, latency, correctness) are binding

Without this record, planners will rediscover the same dead ends. With it, the search space contracts meaningfully over iterations.

---

## 6. Research-Driven Planning

When domain knowledge is lacking, a researcher agent collects evidence before planners start.

### The researcher role

Before each iteration, a researcher agent:
1. Reads the repository structure, recent commits, open issues, and pull requests
2. Searches externally for relevant papers, benchmarks, and similar projects
3. Produces a **research brief**: a ranked list of improvement ideas with supporting evidence

All N planners receive the same research brief. They are expected to build hypotheses from evidence, not generate ideas from imagination alone.

### User-provided ideas

If the user specifies experiment ideas in `goal.md`, planners use those directly. User-provided ideas take priority over researcher-generated ideas. This mirrors the autoresearch pattern where the operator's domain knowledge is treated as high-signal input.

### Research brief format

```markdown
# Research Brief — Iteration N

## Repository Analysis
- Key bottleneck identified: [finding]
- Relevant code paths: [paths]

## External Findings
- Paper: [title] — suggests [approach]
- Similar project: [name] — achieved [result] via [method]

## Ranked Ideas
1. [Idea] — evidence: [source] — estimated impact: [high/medium/low]
2. [Idea] — ...
```

This brief feeds into all N planners, who each select one idea to develop into a hypothesis.

---

## 7. One Hypothesis Per Plan

Each plan tests exactly one idea. This is a hard constraint enforced by the critic.

### The hypothesis format

```
Doing [X] should improve [metric Y] because [mechanistic reason Z].
```

Examples:
- "Replacing the linear scan in `find_nearest()` with a KD-tree should improve query latency because the current O(n) scan is the measured bottleneck."
- "Fusing the normalization and activation passes into a single kernel should improve throughput because it eliminates a memory round-trip."

Each hypothesis must be:
- **Testable**: the benchmark will confirm or deny it
- **Falsifiable**: it must be possible for the experiment to fail
- **Attributed**: tagged with an `approach_family` from the taxonomy

### Approach family taxonomy

```
approach_family:
  algorithmic       # data structure or algorithm change
  numerical         # precision, dtype, approximation
  memory            # allocation, caching, layout
  parallelism       # threading, vectorization, batching
  architecture      # model or system structure change
  configuration     # hyperparameter or compile-time setting
  dependency        # library swap or version upgrade
  pruning           # removing code paths or features
```

The taxonomy enables trend analysis across iterations: if three `algorithmic` approaches have all failed, the researcher can focus future iterations on `memory` or `parallelism`.

### Why single-hypothesis matters

Multi-hypothesis plans ("try X and also Y") cannot be attributed. If the benchmark improves, you do not know whether X or Y caused it. If it regresses, you do not know which change to revert. Single-hypothesis plans make every experiment a clean data point.

---

## 8. Failure Analysis

Every failed experiment produces a structured post-mortem, not just a score.

### Failure categories

| Category | Description |
|---|---|
| `oom` | Executor ran out of memory during benchmark |
| `timeout` | Benchmark did not complete within time limit |
| `regression` | Benchmark score worse than baseline |
| `logic_error` | Code change introduced incorrect behavior (test failures) |
| `scope_error` | Plan tried to modify sealed files or out-of-scope components |
| `infrastructure` | Environment issue (flaky benchmark, dependency failure) |

### Analysis structure

```markdown
## Failure Analysis

- **Category**: regression
- **What failed**: The new KD-tree implementation is slower than the linear scan for n < 1000 (the dominant case in the benchmark).
- **Why it failed**: KD-tree construction cost amortizes only at large n. The benchmark dataset is small.
- **What we learned**: Algorithmic improvements for this metric must account for the actual distribution of n, not worst-case complexity.
- **Implications for future planners**: Skip tree-based approaches unless benchmark inputs are confirmed to be large-n. Investigate input size distribution first.
```

### Feedback loop

Failure analyses feed directly into the next iteration's research brief. The researcher agent reads all failure records and surfaces their lessons as negative constraints: "do not attempt approaches in family X unless condition Y is met."

---

## 9. The Loop

```
LOOP until goal met:
  1. Read goal + history + harness
  2. RESEARCHER explores → research brief
  3. N PLANNERS each produce 1 plan (1 hypothesis)
  4. CRITICS validate against harness
  5. N EXECUTORS run in parallel → benchmark
  6. TOURNAMENT: pick best → merge if no regression
  7. RECORD everything (winners + losers + lessons)
  8. UPDATE VISUALIZATION
  9. Check stop conditions
```

### Step details

1. **Read context**: goal from `goal.md`, all prior iteration records from `docs/agent_defined/iteration_history/`, harness structure from `benchmark/`
2. **Research**: researcher agent produces a ranked brief; user-provided ideas in `goal.md` take priority
3. **Plan**: each of N planners reads the brief + history and writes one hypothesis; plans are independent and generated in parallel
4. **Critic validation**: critic checks each plan for single-hypothesis constraint, approach-family tag, no sealed-file references, and non-duplication of documented failures
5. **Execute**: N executors implement their plans in parallel on separate branches; `scripts/validate.sh` runs after each
6. **Tournament**: all valid benchmark scores compared; highest non-regressing score wins; winner's branch merges to main
7. **Record**: all N records written to `docs/agent_defined/iteration_history/`; no records are deleted or overwritten
8. **Visualize**: progress charts and iteration summary updated
9. **Stop check**: evaluate all stop conditions (section 10)

---

## 10. Stop Conditions

The loop halts when any of the following conditions are met:

| Condition | Description |
|---|---|
| **Target reached** | Benchmark score meets or exceeds the value specified in `goal.md` |
| **Plateau detected** | Improvement per iteration falls below `min_delta` threshold for `plateau_window` consecutive iterations |
| **Max iterations** | Total iteration count reaches `max_iterations` from `settings.json` |
| **Circuit breaker** | N consecutive iterations where all candidates fail (regression, OOM, timeout, or logic error) — indicates a systemic problem requiring human intervention |

### Configuration

```json
// settings.json
{
  "stop_conditions": {
    "target_score": 0.95,
    "plateau_window": 5,
    "min_delta": 0.001,
    "max_iterations": 50,
    "circuit_breaker_n": 3
  }
}
```

When the circuit breaker fires, the system writes a diagnostic report explaining the failure pattern and halts without merging anything. Human review is required before the loop can resume.

---

## 11. Reference Projects

Three prior systems informed the design. Each contributed a distinct pattern.

### autoresearch (Karpathy)

**Contribution**: sealed evaluation + git-as-state-machine

autoresearch pioneered treating git as the state machine for an improvement loop: commit on success, reset on failure. A single agent with a single metric hill-climbs through code changes. The sealed evaluation insight — that benchmark code must be read-only and enforced by script, not agent discipline — came directly from observing agents optimize metrics rather than capability. This system inherits both patterns wholesale.

### Orze

**Contribution**: decentralized orchestration + research agent + circuit breaker

Orze demonstrated that a dedicated research agent (one that explores the repository and searches externally before planners start) significantly improves the quality of improvement ideas. It also introduced the circuit breaker pattern to handle failure cascades gracefully, and showed that decentralized orchestration (agents coordinating via shared state rather than a central director) scales better under parallel execution. This system's researcher role and circuit breaker are directly derived from Orze.

### search-tool-auto-research

**Contribution**: institutional memory + one-hypothesis-per-plan + structured failure analysis

search-tool-auto-research demonstrated that an experiment log — where every result (not just winners) is recorded with structured failure analysis — meaningfully improves planning quality over iterations. It also enforced the one-hypothesis-per-plan constraint as a hard rule and showed that LLM-as-Judge evaluation can be sealed effectively. The institutional memory architecture in `docs/agent_defined/iteration_history/` and the failure category taxonomy in this system come directly from this project.
