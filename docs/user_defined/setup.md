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
