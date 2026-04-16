---
name: si-team-manager
description: Mediate all teammate lifecycle operations (create, kill, handoff, list, notebook, flush-notebook) for the self-improvement loop. Wraps TeamCreate/TeamDelete/SendMessage and enforces registry invariants.
user-invocable: false
allowed-tools: Read, Write, Edit, Bash
effort: medium
---

# Team Manager Skill

## Role

You are the sole gateway between the orchestrator and the teammate subsystem. Every teammate lifecycle operation goes through this skill — the orchestrator never touches `TeamCreate`, `TeamDelete`, `SendMessage`, or `docs/agent_defined/teammate_registry.json` directly. This skill enforces registry invariants (one continuation planner at a time, streak tracking, dead-teammate cleanup, notebook archival on rotation).

## Commands

Each invocation is one of the commands below, selected by the first positional token after `/si-team-manager`.

### `create`

Create a new teammate.

- **Input**: `role=<continuation|challenger> label=<name> round=<N>`
- **Behavior**: Validates role invariants (reject if a continuation already exists), calls `TeamCreate`, writes the entry to the registry, and — for `role=continuation` — sets `continuation.planner_id` in agent settings.

### `kill`

Terminate a teammate.

- **Input**: `id=<teammate_id>`
- **Behavior**: Calls `TeamDelete` for the teammate, removes the entry from the registry, and — if the killed teammate was the continuation planner — nulls `continuation.planner_id` in agent settings.

### `handoff`

Manage the continuation planner lifecycle after tournament selection.

- **Input**: `winner_id=<id> round=<N> score_before=<f> score_after=<f>`
- **Behavior**: Branches on winner role and streak:
  - Continuation wins: streak += 1; challengers killed.
  - Challenger wins: old continuation killed and archived; winner promoted to continuation; notebook archived; streak = 1.
  - No winner: feedback message sent to continuation; challengers killed.
  - Streak >= 3: force rotation — all teammates killed, notebook archived, next round bootstraps fresh challengers.

### `list`

List currently active teammates.

- **Input**: (none)
- **Behavior**: Reads the registry and prints id, role, label, round, and status for every active entry.

### `notebook`

Read or archive the continuation planner's persisted notebook.

- **Input**: `action=<read|archive>`
- **Behavior**:
  - `read`: prints the JSON contents of `docs/agent_defined/notebook.json`.
  - `archive`: copies the current notebook to `docs/agent_defined/notebooks/round_{round}.json` and resets the live notebook to the empty schema.

### `flush-notebook`

Persist the continuation planner's in-memory notebook state to disk after context compaction.

- **Input**: `id=<teammate_id>`
- **Behavior**:
  1. Generate a fresh `request_id` (UUID v4).
  2. Send the teammate `{ "type": "flush_notebook", "request_id": "<uuid>" }` via `SendMessage`.
  3. Await a reply of the form `{ "type": "flush_notebook_ack", "request_id": "<same uuid>", "notebook_path": "<abs path>" }` with a 60-second timeout.
  4. On ack: confirm the notebook file exists at the reported path and return success so the caller (the orchestrator in Step 5) can clear `iteration_state.compaction_pending`.
  5. On timeout or mismatched `request_id`: log the failure, surface the error to the caller, and leave `compaction_pending` set so the next round re-attempts the flush.

This command is how the orchestrator recovers the continuation planner's accumulated context when a PreCompact event fired while the planner was alive. Without it, the continuation planner's notebook goes stale and the EXPLOIT lane loses its memory.

## Invariants

- Exactly zero or one continuation planner is active at any time.
- The registry file is the single source of truth for which teammates exist — never parse orchestrator context or session state to infer teammate membership.
- Notebook archival always accompanies rotation (either challenger promotion or force-rotate-at-streak-3).
- `flush-notebook` does not create, kill, or mutate registry entries; it is a pure persistence ping to an existing teammate.

## Error Handling

| Situation | Action |
|-----------|--------|
| Called with unknown command | Print usage and exit non-zero |
| `create role=continuation` when one already exists | Reject with clear error; do not overwrite |
| `kill id=` for an unknown id | Warn and exit zero (idempotent) |
| `flush-notebook` ack timeout | Return error without clearing `compaction_pending` |
| Registry file missing or corrupted | Surface the corruption; do not silently recreate |
