/**
 * si-session-end.mjs — SessionEnd hook: persists state for next session.
 *
 * @calling-spec
 * - handler(payload, projectRoot): Promise<void>
 *   Input:  payload { session_id: string, hook_event_name: "SessionEnd" }, projectRoot: string
 *   Output: void
 *   Side effects:
 *     1. Reads iteration_state, writes back with updated_at refreshed
 *     2. Reads agent settings, updates last_end/updated_at, writes back
 *     3. Writes .jaewon/context/handoff.md with iteration summary
 *   Depends on: ./lib/state-io.mjs, node:fs, node:path
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  readIterationState,
  writeIterationState,
  readAgentSettings,
  writeAgentSettings,
} from './lib/state-io.mjs';

export default async function handler(payload, projectRoot) {
  const now = new Date().toISOString();

  // 1. Refresh iteration_state with updated_at
  writeIterationState(projectRoot, { updated_at: now });

  // 2. Update agent settings with last_end timestamp
  writeAgentSettings(projectRoot, { last_end: now, updated_at: now });

  // 3. Build and write handoff.md
  const iterState = readIterationState(projectRoot);
  const agentSettings = readAgentSettings(projectRoot);

  const iteration = iterState.iteration ?? 0;
  const step = iterState.current_step ?? 'unknown';
  const continuation = agentSettings.continuation ?? {};
  const plannerId = continuation.planner_id ?? null;
  const streak = continuation.streak ?? 0;
  const bestScore = agentSettings.best_score ?? null;

  const plannerLine = plannerId != null
    ? `Continuation Planner: ${plannerId}`
    : 'Continuation Planner: none';

  const handoff = [
    '# Session Handoff',
    '',
    `- Iteration: ${iteration}`,
    `- Current Step: ${step}`,
    plannerLine,
    `- Streak: ${streak}`,
    `- Best Score: ${bestScore}`,
    '',
    `Next Action: resume from step ${step} (iteration ${iteration})`,
    '',
    `Saved at: ${now}`,
  ].join('\n');

  const handoffPath = path.join(projectRoot, '.jaewon', 'context', 'handoff.md');
  fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
  fs.writeFileSync(handoffPath, handoff, 'utf8');
}
