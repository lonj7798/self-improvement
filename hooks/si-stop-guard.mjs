/**
 * si-stop-guard.mjs — Stop hook handler that blocks premature stops during critical loop steps.
 *
 * @calling-spec
 * - handler(payload, projectRoot): Promise<Decision>
 *   Input:  payload (object, ignored), projectRoot (string, absolute path to project root)
 *   Output: { decision: "block", reason: string }
 *         | { decision: "allow" }
 *         | { decision: "allow", warning: string }
 *   Side effects: reads iteration_state.json and agent_defined/settings.json via state-io
 *   Depends on: ./lib/state-io.mjs (readIterationState, readAgentSettings)
 */

import { readIterationState, readAgentSettings } from './lib/state-io.mjs';

const CRITICAL_STEPS = ['execution', 'tournament', 'recording'];
const WARN_STEPS = ['research', 'planning'];

export default async function handler(payload, projectRoot) {
  const agentSettings = readAgentSettings(projectRoot);

  // Priority 1: stop_requested overrides everything
  if (agentSettings.status === 'stop_requested') {
    return { decision: 'allow' };
  }

  const iterState = readIterationState(projectRoot);
  const step = iterState.current_step;

  // Priority 2: block during critical steps
  if (CRITICAL_STEPS.includes(step)) {
    return {
      decision: 'block',
      reason: `Cannot stop during ${step} — this step must complete to preserve data integrity.`,
    };
  }

  // Priority 3: warn but allow during soft steps
  if (WARN_STEPS.includes(step)) {
    return {
      decision: 'allow',
      warning: `Stopping during ${step} — partial work will be lost and must restart next run.`,
    };
  }

  // Default: allow freely (stop_check, completed, idle, etc.)
  return { decision: 'allow' };
}
