# Setup Phase

> Checklist for preparing the self-improvement loop. Each step sets a flag in settings once complete.
> The loop will not start until all flags are true.

## Quick Setup

Run the interactive setup script to configure everything:

```bash
python3 docs/user_defined/initial_setup.py
```

The script walks through Steps 0-4 below, sets all flags, and validates the benchmark.

---

## Step 0 — Claude Setup

Verify `claude/` source and install to `.claude/`.

**0a — Verify** all required files exist in `claude/` (source of truth):
- [ ] `claude/agents/si-researcher/CLAUDE.md`
- [ ] `claude/agents/si-planner/CLAUDE.md`
- [ ] `claude/agents/si-planner/skills/si-plan-creator/SKILL.md`
- [ ] `claude/agents/si-planner/skills/si-plan-architect/SKILL.md`
- [ ] `claude/agents/si-planner/skills/si-plan-critic/SKILL.md`
- [ ] `claude/agents/si-executor/CLAUDE.md`
- [ ] `claude/agents/si-github-manager/CLAUDE.md`
- [ ] `claude/skills/si-goal-clarifier/SKILL.md`
- [ ] `claude/skills/si-benchmark-builder/SKILL.md`

**0b — Install** `claude/` → `.claude/`:

```bash
cp -r claude/agents/.  .claude/agents/
cp -r claude/skills/.  .claude/skills/
cp claude/settings.json .claude/settings.json
```

If any files are missing, report which ones and stop.

**Flag:** `si_claude_setting` → `true` in `docs/user_defined/settings.json`

---

## Step 1 — Repository

Clone or link a GitHub repo to `want_to_improve/`.

- Record the URL in `docs/user_defined/settings.json` as `current_repo_url`.
- Optionally fill in `docs/user_defined/repo.md` with description, key files, and notes.

### Step 1b — Fork Setup (recommended)

Fork the target repo so all improvement work happens on the fork. The self-improvement repo stays branch-clean.

**Prerequisites:** `gh` CLI installed and authenticated (`gh auth status`).

1. Fork the upstream repo: `gh repo fork <upstream_url> --clone=false`
2. Configure remotes in `want_to_improve/`:
   ```bash
   git -C want_to_improve remote rename origin upstream
   git -C want_to_improve remote add origin <fork_url>
   ```
3. Verify: `git -C want_to_improve remote -v` shows:
   - `origin` → your fork (push/fetch)
   - `upstream` → original repo (fetch only)
4. Record URLs in `docs/user_defined/settings.json`:
   - `fork_url` → your fork's URL
   - `upstream_url` → original repo's URL

**If you skip forking** (e.g., you own the repo): set `fork_url = upstream_url` in settings. The system degrades gracefully to same-repo PRs.

---

## Step 2 — Goal

Clarify the improvement goal with the user (skip if already clear).

- Fill in `docs/user_defined/goal.md` with objective, target metric, target value, scope.
- If the goal is unclear, invoke `/si-goal-clarifier` to analyze the repo and help define it.

**Flag:** `si_setting_goal` → `true` in `docs/agent_defined/settings.json`

---

## Step 3 — Benchmark

User provides evaluation code or command.

- Set `benchmark_command` in `docs/user_defined/settings.json`.
- Verify it runs and produces valid output matching `benchmark_format`.
- Record baseline score to `tracking_history/baseline.json`.
- If no benchmark exists, invoke `/si-benchmark-builder` to create one.

**Flag:** `si_setting_benchmark` → `true` in `docs/agent_defined/settings.json`

---

## Step 3b — Agent Count

Ask the user how many parallel agents to run per iteration.

- Ask: "How many parallel agents should explore improvements each iteration?"
- Explain the tradeoff:
  - **1 agent**: Best for scratch-level or early-stage repos where the codebase is small, the goal is exploratory, or you want to minimize cost. One hypothesis per iteration, simpler to debug.
  - **2-3 agents** (default: 3): Good balance for most repos. Multiple hypotheses compete, increasing the chance of finding improvements per iteration.
  - **4+ agents**: For large codebases with many improvement vectors. Higher cost per iteration but faster exploration of the hypothesis space.
- If the user is starting from scratch (no existing benchmark, vague goal, small repo), suggest starting with **1 agent** and scaling up after the first few iterations prove the loop works.
- Set `number_of_agents` in `docs/user_defined/settings.json`.

---

## Step 4 — Harness

Configure guardrail rules in `docs/user_defined/harness.md`.

- Default rules (H001, H002, H003) are always active.
- Add custom rules if needed, or confirm defaults are sufficient.

**Flag:** `si_setting_harness` → `true` in `docs/agent_defined/settings.json`

---

## Gate Check

All of the following must be `true` before the improvement loop can start:

| Flag | Location |
|------|----------|
| `si_claude_setting` | `docs/user_defined/settings.json` |
| `si_setting_goal` | `docs/agent_defined/settings.json` |
| `si_setting_benchmark` | `docs/agent_defined/settings.json` |
| `si_setting_harness` | `docs/agent_defined/settings.json` |

---

## After Setup

Once all gates pass, **restart the Claude Code session** before starting the improvement loop. This ensures:
- The orchestrator loads fresh settings (agent count, benchmark command, fork config)
- `.claude/` has the latest installed agents and skills from Step 0
- No stale state from the setup conversation carries over into the loop

To start the loop, open a new session and run `claude` from the project root. The orchestrator will detect all gates are `true` and begin automatically.

## How to Stop the Loop

To gracefully stop the improvement loop after the current iteration finishes:

1. Open `docs/agent_defined/settings.json`
2. Set `"status": "stop_requested"`
3. Save the file

The loop will complete its current iteration, then exit cleanly at Step 10 with `status: "user_stopped"`. No work is lost — the current iteration's results are fully recorded before stopping.

**Other ways to stop:**
- Set `max_iterations` in `docs/user_defined/settings.json` to the current iteration count (stops at Step 10)
- Kill the Claude Code session (ungraceful — may leave partial state, but resumability handles it)

## On-the-Fly Changes

While the loop is running, you can modify these files and they take effect at the next iteration:

| File | What to change | When it takes effect |
|------|---------------|---------------------|
| `docs/user_defined/idea.md` | Add experiment ideas | Next Step 5 (planners read them) |
| `docs/user_defined/settings.json` | `number_of_agents`, `target_value`, `max_iterations`, `sealed_files` | Next iteration start (settings re-read at each step) |
| `docs/agent_defined/settings.json` | `status` → `"stop_requested"` | Next Step 10 (graceful stop) |

**Note:** Changing `benchmark_command` mid-loop makes old scores incomparable. If you change it, also reset `best_score` to `null` in `docs/agent_defined/settings.json`.
