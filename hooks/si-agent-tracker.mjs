/**
 * si-agent-tracker.mjs — SubagentStop hook that validates agent output and advances
 * the iteration state machine based on which agent type just completed.
 *
 * @calling-spec
 * - handler(payload, projectRoot): Promise<void>
 *   Input:  payload ({ agent_id, agent_type, exit_status, iteration, ...extras }),
 *           projectRoot (string, absolute path to self-improvement project root)
 *   Output: void
 *   Side effects: reads/writes iteration_state.json; may write findings files
 *   Depends on: ./lib/state-io.mjs (readIterationState, writeIterationState,
 *                                   readUserSettings, readJSON, writeJSON)
 */

import fs from 'node:fs';
import path from 'node:path';
import { readIterationState, writeIterationState, readUserSettings, readJSON, writeJSON } from './lib/state-io.mjs';

function agentFamily(t) {
  if (!t) return 'unknown';
  if (t.startsWith('researcher')) return 'researcher';
  if (t.startsWith('planner')) return 'planner';
  if (t === 'critic') return 'critic';
  if (t.startsWith('executor')) return 'executor';
  if (t === 'github-manager') return 'github-manager';
  return 'unknown';
}

function iterNum(payload, state) { return payload.iteration ?? state.iteration; }

function allSettled(map, key, doneStatuses) {
  return Object.values(map).every((e) => doneStatuses.includes(e[key]));
}

function mergedEntry(map, id, patch) {
  return Object.assign({}, map, { [id]: Object.assign({}, map[id] ?? {}, patch) });
}

function handleResearcher(payload, projectRoot, state) {
  const briefPath = path.join(projectRoot, 'docs', 'agent_defined', 'research_briefs', `round_${iterNum(payload, state)}.json`);
  const ok = fs.existsSync(briefPath);
  const updates = { research: ok
    ? { status: 'completed', output_path: briefPath, completed_at: new Date().toISOString() }
    : { status: 'failed', completed_at: new Date().toISOString() } };
  if (ok) updates.current_step = 'planning';
  writeIterationState(projectRoot, updates);
}

function handlePlanner(payload, projectRoot, state) {
  const id = payload.planner_id ?? payload.agent_id;
  const planPath = path.join(projectRoot, 'docs', 'plans', `round_${iterNum(payload, state)}`, `plan_${id}.json`);
  const ok = fs.existsSync(planPath);
  const entry = ok ? { status: 'completed', output_path: planPath } : { status: 'failed', output_path: null };
  const plans = mergedEntry(state.planning.plans, id, entry);
  const updates = { planning: { plans } };
  if (allSettled(plans, 'status', ['completed', 'failed'])) {
    const s = readUserSettings(projectRoot);
    updates.current_step = s?.hybrid_planner?.enabled === true ? 'hybrid' : 'critic_review';
  }
  writeIterationState(projectRoot, updates);
}

function readCriticApproved(planId, state, projectRoot, iteration) {
  const outputPath = state.planning.plans[planId]?.output_path
    ?? path.join(projectRoot, 'docs', 'plans', `round_${iteration}`, `plan_${planId}.json`);
  const data = readJSON(outputPath);
  return (data && typeof data.critic_approved === 'boolean') ? data.critic_approved : null;
}

function handleCritic(payload, projectRoot, state) {
  const planId = payload.plan_id;
  const verdict = planId ? readCriticApproved(planId, state, projectRoot, iterNum(payload, state)) : null;
  const plans = planId && planId in state.planning.plans
    ? mergedEntry(state.planning.plans, planId, { critic_approved: verdict })
    : state.planning.plans;
  const updates = { planning: { plans } };
  if (allSettled(plans, 'critic_approved', [true, false])) {
    const s = readUserSettings(projectRoot);
    updates.current_step = s?.de_risk?.enabled === true ? 'de_risk' : 'execution';
  }
  writeIterationState(projectRoot, updates);
}

function handleExecutor(payload, projectRoot, state) {
  const id = payload.executor_id ?? payload.agent_id;
  const result = payload.worktree_dir ? readJSON(path.join(payload.worktree_dir, 'result.json')) : null;
  const score = result?.benchmark_score ?? null;
  const status = result?.status === 'success' ? 'completed' : 'failed';
  const findingsPath = path.join(projectRoot, 'docs', 'agent_defined', 'findings', `round_${iterNum(payload, state)}_${id}.json`);
  writeJSON(findingsPath, { executor_id: id, iteration: iterNum(payload, state), benchmark_score: score, status, published_at: new Date().toISOString() });
  const executors = mergedEntry(state.execution.executors, id, { status, benchmark_score: score, output_path: findingsPath });
  const updates = { execution: { executors } };
  if (allSettled(executors, 'status', ['completed', 'failed'])) updates.current_step = 'tournament';
  writeIterationState(projectRoot, updates);
}

function handleGithubManager(payload, projectRoot) {
  writeIterationState(projectRoot, {
    tournament: { winner: payload.winner ?? null, winner_score: payload.winner_score ?? null, completed_at: new Date().toISOString() },
    current_step: 'recording',
  });
}

export default async function handler(payload, projectRoot) {
  const family = agentFamily(payload.agent_type ?? '');
  if (family === 'unknown') {
    process.stderr.write(`[si-agent-tracker] WARNING: unknown agent_type "${payload.agent_type}" (agent_id="${payload.agent_id}") — no state update performed\n`);
    return;
  }
  const state = readIterationState(projectRoot);
  if (family === 'researcher') handleResearcher(payload, projectRoot, state);
  else if (family === 'planner') handlePlanner(payload, projectRoot, state);
  else if (family === 'critic') handleCritic(payload, projectRoot, state);
  else if (family === 'executor') handleExecutor(payload, projectRoot, state);
  else if (family === 'github-manager') handleGithubManager(payload, projectRoot);
}
