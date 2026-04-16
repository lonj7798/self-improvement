/**
 * state-io.mjs — Shared JSON state I/O for hook infrastructure. Node.js built-ins only.
 *
 * @calling-spec
 * - readJSON(filePath): object|null — parse file; null on any error
 * - writeJSON(filePath, data): void — atomic write (tmp+rename), creates parent dirs
 * - readIterationState(projectRoot): IterationState — reads iteration_state.json, merges defaults
 * - writeIterationState(projectRoot, updates): void — deep-merge updates, write back
 * - readAgentSettings(projectRoot): AgentSettings — reads agent_defined/settings.json
 * - writeAgentSettings(projectRoot, updates): void — deep-merge updates, write back
 * - readUserSettings(projectRoot): UserSettings — reads user_defined/settings.json
 * - validateSchema(schemaName, data): {valid,errors} — checks required fields/types
 * - backupFile(filePath): string — copies to .backup/${base}.${ts}, returns backup path
 */

import fs from 'node:fs';
import path from 'node:path';

export function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

export function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function iterationStateDefaults() {
  return {
    iteration: 0, status: 'idle', current_step: null, started_at: null, updated_at: null,
    research:   { status: 'pending', output_path: null, completed_at: null },
    planning:   { status: 'pending', plans: {}, approved_count: 0, completed_at: null },
    execution:  { status: 'pending', executors: {}, completed_at: null },
    tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
    recording:  { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
    user_ideas_consumed: [],
  };
}

function deepMerge(target, source) {
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    const sv = source[key], tv = target[key];
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
        tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      result[key] = deepMerge(tv, sv);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

export function readIterationState(projectRoot) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'iteration_state.json');
  return deepMerge(iterationStateDefaults(), readJSON(fp) ?? {});
}

export function writeIterationState(projectRoot, updates) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'iteration_state.json');
  writeJSON(fp, deepMerge(readIterationState(projectRoot), updates));
}

export function readAgentSettings(projectRoot) {
  return readJSON(path.join(projectRoot, 'docs', 'agent_defined', 'settings.json')) ?? {};
}

export function writeAgentSettings(projectRoot, updates) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
  writeJSON(fp, deepMerge(readAgentSettings(projectRoot), updates));
}

export function readUserSettings(projectRoot) {
  return readJSON(path.join(projectRoot, 'docs', 'user_defined', 'settings.json')) ?? {};
}

// [field, expectedType | null]  null = present-only check (any type including null)
const SCHEMAS = {
  iteration_state: [
    ['iteration','number'],['status','string'],['current_step',null],['started_at',null],
    ['updated_at',null],['research','object'],['planning','object'],['execution','object'],
    ['tournament','object'],['recording','object'],['user_ideas_consumed','array'],
  ],
  agent_settings: [
    ['iterations','number'],['si_setting_goal',null],['si_setting_benchmark',null],
    ['si_setting_harness',null],['best_score',null],['current_milestone',null],
    ['current_phase',null],['plateau_consecutive_count','number'],
    ['circuit_breaker_count','number'],['status','string'],
  ],
  user_settings: [
    ['si_claude_setting',null],['number_of_agents','number'],['number_of_max_critics','number'],
    ['current_repo_url','string'],['fork_url','string'],['upstream_url','string'],
    ['target_branch','string'],['benchmark_command','string'],['benchmark_format','string'],
    ['benchmark_direction','string'],['max_iterations','number'],['plateau_threshold',null],
    ['plateau_window',null],['target_value',null],['primary_metric','string'],
    ['sealed_files','array'],['regression_threshold',null],['circuit_breaker_threshold',null],
  ],
  notebook: [
    ['planner_id',null],['rounds_active','array'],['streak','number'],
    ['observations','array'],['dead_ends','array'],['current_theory',null],
  ],
  teammate_registry: [['teammates','array'],['updated_at',null]],
};

export function validateSchema(schemaName, data) {
  const fields = SCHEMAS[schemaName];
  if (!fields) return { valid: false, errors: [`Unknown schema: ${schemaName}`] };
  const errors = [];
  for (const [field, type] of fields) {
    if (!(field in data)) { errors.push(`Missing required field: ${field}`); continue; }
    if (type === 'array' && !Array.isArray(data[field]))
      errors.push(`Field "${field}" must be an array`);
    else if (type && type !== 'array' && typeof data[field] !== type)
      errors.push(`Field "${field}" must be of type ${type}`);
  }
  return { valid: errors.length === 0, errors };
}

export function backupFile(filePath) {
  const backupDir = path.join(path.dirname(filePath), '.backup');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${path.basename(filePath)}.${Date.now()}`);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}
