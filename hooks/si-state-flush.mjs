/**
 * si-state-flush.mjs — PreCompact hook: flushes state before context compaction.
 * File-I/O only. No Claude Code API calls.
 *
 * @calling-spec
 * - handler(payload, projectRoot): Promise<void>
 *   Input:  payload { hook_event_name: "PreCompact", ... }, projectRoot: string (abs path)
 *   Output: void
 *   Side effects:
 *     1. Force-writes iteration_state.json with refreshed updated_at
 *     2. Sets compaction_pending: true in iteration_state when continuation.planner_id is set
 *     3. Re-writes agent settings to flush recent_winners
 *     4. Does NOT modify notebook.json
 *   Depends on: ./lib/state-io.mjs
 */

import {
  readIterationState,
  writeIterationState,
  readAgentSettings,
  writeAgentSettings,
} from './lib/state-io.mjs';

export default async function handler(payload, projectRoot) {
  // Read current state (gracefully handles missing files via defaults)
  const iterState = readIterationState(projectRoot);
  const agentSettings = readAgentSettings(projectRoot);

  // Build iteration_state updates: always refresh updated_at
  const stateUpdates = { updated_at: new Date().toISOString() };

  // Set compaction_pending when continuation planner is active
  if (agentSettings.continuation?.planner_id) {
    stateUpdates.compaction_pending = true;
  }

  // Force-write iteration_state.json
  writeIterationState(projectRoot, stateUpdates);

  // Flush agent settings (re-write to persist recent_winners and other runtime state)
  writeAgentSettings(projectRoot, {});
}
