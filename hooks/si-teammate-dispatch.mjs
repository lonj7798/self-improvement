/**
 * si-teammate-dispatch.mjs — TeammateIdle hook that dispatches work to idle planner teammates.
 *
 * @calling-spec
 * - handler(payload, projectRoot): Promise<object>
 *   Input:  payload ({ teammate_id, hook_event_name, ... }),
 *           projectRoot (string, absolute path to self-improvement project root)
 *   Output: { action, role?, brief? }
 *     - { action: "no_action" }                        — teammate not found or no work available
 *     - { action: "dispatch", role, brief }            — send planning work to this teammate
 *     - { action: "handoff_feedback", role }           — send winner feedback to this teammate
 *   Side effects: none (read-only)
 *   Depends on: ./lib/state-io.mjs (readIterationState, readJSON),
 *               ./lib/registry-io.mjs (readRegistry)
 */

import path from 'node:path';
import { readIterationState, readJSON } from './lib/state-io.mjs';
import { readRegistry } from './lib/registry-io.mjs';

// ---------------------------------------------------------------------------
// Helper: find teammate entry by ID
// ---------------------------------------------------------------------------

function findTeammate(registry, teammateId) {
  return registry.teammates.find((t) => t.id === teammateId) ?? null;
}

// ---------------------------------------------------------------------------
// Helper: check if teammate already has an assigned plan
// ---------------------------------------------------------------------------

function isUnassigned(state, teammateId) {
  const plans = state.planning?.plans ?? {};
  return !(teammateId in plans);
}

// ---------------------------------------------------------------------------
// Helper: load the research brief for the current iteration
// ---------------------------------------------------------------------------

function loadBrief(projectRoot, state) {
  const briefPath = state.research?.output_path;
  if (!briefPath) return null;
  const absPath = path.isAbsolute(briefPath)
    ? briefPath
    : path.join(projectRoot, briefPath);
  return readJSON(absPath);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(payload, projectRoot) {
  const { teammate_id: teammateId } = payload;

  const registry = await readRegistry(projectRoot);
  const teammate = findTeammate(registry, teammateId);

  if (!teammate) {
    return { action: 'no_action' };
  }

  const { role } = teammate;
  const state = readIterationState(projectRoot);
  const step = state.current_step;

  if (step === 'planning' && isUnassigned(state, teammateId)) {
    const brief = loadBrief(projectRoot, state);
    return { action: 'dispatch', role, brief };
  }

  if (step === 'winner_handoff') {
    return { action: 'handoff_feedback', role };
  }

  return { action: 'no_action', role };
}
