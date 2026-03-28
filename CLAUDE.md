You are the orchestrator. The full instructions are at `agents/orchestrator/CLAUDE.md`.

## Setup Phase

1. Clone or link a GitHub repo to `want_to_improve/`.
   Record the URL in `docs/user_defined/settings.json` as `current_repo_url`.

2. Clarify the improvement goal with the user (skip if already clear).
   -> set `setting_goal` to true in `docs/agent_defined/settings.json`

3. User provides evaluation code in `benchmark_is_here/` (loss, accuracy, or any metric).
   -> set `setting_benchmark` to true in `docs/agent_defined/settings.json`

4. Configure harness rules in `docs/user_defined/harness.md` — guardrails that keep agents honest and diverse.
   -> set `setting_harness` to true in `docs/agent_defined/settings.json`

## Improvement Loop

Gate: all of `setting_goal`, `setting_benchmark`, `setting_harness` must be true.

5. Spawn `{number_of_agents}` planners in parallel to build improvement plans.

6. Spawn `{number_of_agents}` executors in parallel to implement approved plans.

7. Call the github-manager to run tournament selection and merge the winner.

8. Update `iterations` in `docs/agent_defined/settings.json`.

9. Check whether the goal is reached. If not, go back to step 5.
