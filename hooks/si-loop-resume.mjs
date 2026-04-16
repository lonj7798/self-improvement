/**
 * si-loop-resume.mjs — SessionStart hook handler for the self-improvement loop.
 * Determines whether to resume an in-progress iteration, start the next one,
 * or perform a fresh start. Also validates continuation planner health.
 *
 * @calling-spec
 * - handler(payload, projectRoot): Promise<ResumeResult>
 *   Input: payload (SessionStart hook object), projectRoot (absolute path string)
 *   Output: { action, step?, continuation_planner_id? }
 *     action: "resume" | "start_next" | "fresh_start" | "configuration_error"
 *     step: present when action === "resume"; the current_step from iteration_state
 *     continuation_planner_id: present when agent settings have continuation config;
 *       null if planner was dead (and settings updated), or the preserved id if alive
 *   Side effects: may write to agent_defined/settings.json if dead planner detected
 *   Depends on: ./lib/state-io.mjs, ./lib/registry-io.mjs
 */

import path from 'node:path';
import fs from 'node:fs';
import {
  readIterationState,
  readAgentSettings,
  writeAgentSettings,
  readJSON,
} from './lib/state-io.mjs';
import { readRegistry } from './lib/registry-io.mjs';

function userSettingsFilePath(projectRoot) {
  return path.join(projectRoot, 'docs', 'user_defined', 'settings.json');
}

function iterationStateFilePath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'iteration_state.json');
}

/**
 * Checks if the user settings file exists and is valid JSON.
 * Returns true if valid, false if missing or corrupt.
 */
function isUserSettingsValid(projectRoot) {
  const fp = userSettingsFilePath(projectRoot);
  if (!fs.existsSync(fp)) return false;
  const parsed = readJSON(fp);
  return parsed !== null;
}

/**
 * Checks the continuation planner health.
 * If planner_id is set but not found in registry, nulls it in settings and returns null.
 * If planner_id is set and found active in registry, returns the id unchanged.
 * If planner_id is null, returns null.
 */
async function resolveContinuationPlanner(projectRoot, agentSettings) {
  const plannerId = agentSettings.continuation?.planner_id ?? null;
  if (!plannerId) return null;

  const registry = await readRegistry(projectRoot);
  const isAlive = registry.teammates.some((t) => t.id === plannerId);

  if (!isAlive) {
    writeAgentSettings(projectRoot, { continuation: { planner_id: null } });
    return null;
  }

  return plannerId;
}

export default async function handler(payload, projectRoot) {
  // Validate user settings first — corrupt settings are a configuration error
  if (!isUserSettingsValid(projectRoot)) {
    return { action: 'configuration_error' };
  }

  // Determine resume action from iteration state
  const iterationStateFile = iterationStateFilePath(projectRoot);
  const iterationStateExists = fs.existsSync(iterationStateFile);

  if (!iterationStateExists) {
    return { action: 'fresh_start' };
  }

  const iterationState = readIterationState(projectRoot);
  const agentSettings = readAgentSettings(projectRoot);
  const continuationPlannerId = await resolveContinuationPlanner(projectRoot, agentSettings);

  if (iterationState.status === 'completed') {
    return { action: 'start_next', continuation_planner_id: continuationPlannerId };
  }

  // in_progress (or any other status) → resume
  return {
    action: 'resume',
    step: iterationState.current_step,
    continuation_planner_id: continuationPlannerId,
  };
}
