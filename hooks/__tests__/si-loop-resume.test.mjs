/**
 * si-loop-resume.test.mjs
 * RED phase tests for Task 5.1: hooks/si-loop-resume.mjs (SessionStart hook)
 *
 * All 6 tests FAIL until the implementation file is created.
 * Expected failure reason: ERR_MODULE_NOT_FOUND (si-loop-resume.mjs does not exist)
 *
 * Run: node --test hooks/__tests__/si-loop-resume.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Import from the module that does NOT exist yet -- this is the RED phase.
// Every test will fail at module-load time with ERR_MODULE_NOT_FOUND.
import handler from '../si-loop-resume.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a unique temporary directory per test group so tests are
 * fully isolated regardless of execution order.
 */
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'si-loop-resume-test-'));
}

/**
 * Recursively remove a directory.
 */
function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Write a JSON file at the given absolute path, creating parent dirs as needed.
 */
function writeFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Return the canonical iteration_state.json path for a given projectRoot.
 */
function iterationStatePath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'iteration_state.json');
}

/**
 * Return the canonical agent settings path for a given projectRoot.
 */
function agentSettingsPath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
}

/**
 * Return the canonical user settings path for a given projectRoot.
 */
function userSettingsPath(projectRoot) {
  return path.join(projectRoot, 'docs', 'user_defined', 'settings.json');
}

/**
 * Return the canonical teammate registry path for a given projectRoot.
 */
function registryPath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'teammate_registry.json');
}

/**
 * Seed all three required state files in a temp project root with sensible
 * defaults so each test only needs to override the fields it cares about.
 */
function seedProjectRoot(projectRoot, {
  iterationState = {},
  agentSettings = {},
  userSettings = {},
  registry = null,
} = {}) {
  // iteration_state.json
  writeFile(iterationStatePath(projectRoot), {
    iteration: 1,
    status: 'in_progress',
    current_step: 'research',
    started_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-15T08:05:00.000Z',
    research: { status: 'pending', output_path: null, completed_at: null },
    planning: { status: 'pending', plans: {}, approved_count: 0, completed_at: null },
    execution: { status: 'pending', executors: {}, completed_at: null },
    tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
    recording: { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
    user_ideas_consumed: [],
    ...iterationState,
  });

  // docs/agent_defined/settings.json
  writeFile(agentSettingsPath(projectRoot), {
    iterations: 0,
    si_setting_goal: true,
    si_setting_benchmark: true,
    si_setting_harness: true,
    best_score: null,
    current_milestone: null,
    current_phase: null,
    plateau_consecutive_count: 0,
    circuit_breaker_count: 0,
    status: 'running',
    continuation: { planner_id: null, streak: 0, notebook_path: null },
    retrospection_state: { last_round: null, reshaped: false, reshape_trigger_round: null },
    recent_winners: [],
    hybrid_stats: { total: 0, wins: 0, skips: 0 },
    ...agentSettings,
  });

  // docs/user_defined/settings.json
  writeFile(userSettingsPath(projectRoot), {
    si_claude_setting: true,
    number_of_agents: 3,
    number_of_max_critics: 3,
    current_repo_url: 'https://github.com/example/repo',
    fork_url: 'https://github.com/jaewon/repo',
    upstream_url: 'https://github.com/example/repo',
    target_branch: 'main',
    benchmark_command: 'python3 scripts/benchmark.py',
    benchmark_format: 'json',
    benchmark_direction: 'higher_is_better',
    max_iterations: 50,
    plateau_threshold: 0.01,
    plateau_window: 3,
    target_value: null,
    primary_metric: 'primary',
    sealed_files: [],
    regression_threshold: 0.05,
    circuit_breaker_threshold: 3,
    hybrid_planner: { enabled: false, skip_when_all_diverse: true, redundancy_threshold_pct: 80 },
    de_risk: { enabled: true, timeout_seconds: 60, reduced_dataset_flag: '--subset 32' },
    simplicity: { max_lines_added: 200, threshold_pct: 5, tiebreak_by_lines: true },
    retrospection: { enabled: true, interval: 3, plateau_reshape_rounds: 1, near_miss_threshold_pct: 2, failure_rate_threshold_pct: 50, family_concentration_window: 3 },
    ...userSettings,
  });

  // teammate_registry.json (optional)
  if (registry !== null) {
    writeFile(registryPath(projectRoot), registry);
  }
}

// ---------------------------------------------------------------------------
// Shared empty payload -- SessionStart hooks receive session metadata but
// the handler under test only uses projectRoot for state file discovery.
// ---------------------------------------------------------------------------
const SESSION_PAYLOAD = {
  session_id: 'sess-test-001',
  hook_event_name: 'SessionStart',
};

// ---------------------------------------------------------------------------
// Test 1: returns resume action with current step when iteration is in_progress
// ---------------------------------------------------------------------------

describe('handler -- in_progress iteration state', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 3,
        status: 'in_progress',
        current_step: 'execution',
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return resume action with current step when iteration is in_progress', async () => {
    // Arrange -- iteration_state has status="in_progress" and current_step="execution"
    // (seeded in before())

    // Act
    const result = await handler(SESSION_PAYLOAD, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(result.action, 'resume', 'action must be "resume" for in_progress iteration');
    assert.equal(
      result.step,
      'execution',
      'step must equal the current_step from iteration_state'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2: returns start_next action when iteration is completed
// ---------------------------------------------------------------------------

describe('handler -- completed iteration state', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 2,
        status: 'completed',
        current_step: 'stop_check',
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return start_next action when iteration is completed', async () => {
    // Arrange -- iteration_state has status="completed"
    // (seeded in before())

    // Act
    const result = await handler(SESSION_PAYLOAD, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.action,
      'start_next',
      'action must be "start_next" when last iteration completed successfully'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: returns fresh_start action when iteration_state is missing
// ---------------------------------------------------------------------------

describe('handler -- missing iteration_state file', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Seed only agent_settings and user_settings -- no iteration_state.json
    writeFile(agentSettingsPath(tmpDir), {
      iterations: 0,
      si_setting_goal: true,
      si_setting_benchmark: true,
      si_setting_harness: true,
      best_score: null,
      current_milestone: null,
      current_phase: null,
      plateau_consecutive_count: 0,
      circuit_breaker_count: 0,
      status: 'idle',
      continuation: { planner_id: null, streak: 0, notebook_path: null },
      retrospection_state: { last_round: null, reshaped: false, reshape_trigger_round: null },
      recent_winners: [],
      hybrid_stats: { total: 0, wins: 0, skips: 0 },
    });
    writeFile(userSettingsPath(tmpDir), {
      si_claude_setting: true,
      number_of_agents: 3,
      number_of_max_critics: 3,
      current_repo_url: 'https://github.com/example/repo',
      fork_url: 'https://github.com/jaewon/repo',
      upstream_url: 'https://github.com/example/repo',
      target_branch: 'main',
      benchmark_command: 'python3 scripts/benchmark.py',
      benchmark_format: 'json',
      benchmark_direction: 'higher_is_better',
      max_iterations: 50,
      plateau_threshold: 0.01,
      plateau_window: 3,
      target_value: null,
      primary_metric: 'primary',
      sealed_files: [],
      regression_threshold: 0.05,
      circuit_breaker_threshold: 3,
      hybrid_planner: { enabled: false, skip_when_all_diverse: true, redundancy_threshold_pct: 80 },
      de_risk: { enabled: true, timeout_seconds: 60, reduced_dataset_flag: '--subset 32' },
      simplicity: { max_lines_added: 200, threshold_pct: 5, tiebreak_by_lines: true },
      retrospection: { enabled: true, interval: 3, plateau_reshape_rounds: 1, near_miss_threshold_pct: 2, failure_rate_threshold_pct: 50, family_concentration_window: 3 },
    });
    // Intentionally NOT writing iteration_state.json
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return fresh_start action when iteration_state is missing', async () => {
    // Arrange -- iteration_state.json does not exist on disk
    // (verified here before the act)
    assert.ok(
      !fs.existsSync(iterationStatePath(tmpDir)),
      'iteration_state.json must not exist for this test'
    );

    // Act
    const result = await handler(SESSION_PAYLOAD, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.action,
      'fresh_start',
      'action must be "fresh_start" when iteration_state.json is absent'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4: detects dead continuation planner and nulls planner_id
// ---------------------------------------------------------------------------

describe('handler -- dead continuation planner', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Agent settings reference a continuation planner id that does NOT appear
    // in the registry (simulating a dead/lost planner process)
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 5,
        status: 'in_progress',
        current_step: 'planning',
      },
      agentSettings: {
        continuation: {
          planner_id: 'agent-continuation-planner-999',
          streak: 4,
          notebook_path: 'docs/agent_defined/notebook.json',
        },
      },
      registry: {
        teammates: [
          // Registry contains unrelated teammates -- NOT the continuation planner
          {
            id: 'agent-researcher-001',
            role: 'researcher',
            status: 'active',
            session_id: 'sess-aaa',
            started_at: '2026-04-15T07:00:00.000Z',
          },
        ],
        updated_at: '2026-04-15T08:00:00.000Z',
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should detect dead continuation planner and set planner_id to null', async () => {
    // Arrange -- continuation.planner_id is set but that id is absent from registry
    // (seeded in before())

    // Act
    const result = await handler(SESSION_PAYLOAD, tmpDir);

    // Assert -- the returned action object must expose the cleared planner_id
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.continuation_planner_id,
      null,
      'continuation_planner_id must be null when planner is not found in registry'
    );

    // Also verify the agent settings file on disk was updated
    const settingsOnDisk = JSON.parse(fs.readFileSync(agentSettingsPath(tmpDir), 'utf8'));
    assert.equal(
      settingsOnDisk.continuation.planner_id,
      null,
      'continuation.planner_id in agent_defined/settings.json must be written as null'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: returns configuration_error when user settings invalid
// ---------------------------------------------------------------------------

describe('handler -- corrupt user settings', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Write a valid iteration_state and agent_settings, but corrupt user settings
    writeFile(iterationStatePath(tmpDir), {
      iteration: 1,
      status: 'in_progress',
      current_step: 'research',
      started_at: '2026-04-15T08:00:00.000Z',
      updated_at: '2026-04-15T08:05:00.000Z',
      research: { status: 'pending', output_path: null, completed_at: null },
      planning: { status: 'pending', plans: {}, approved_count: 0, completed_at: null },
      execution: { status: 'pending', executors: {}, completed_at: null },
      tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
      recording: { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
      user_ideas_consumed: [],
    });
    writeFile(agentSettingsPath(tmpDir), {
      iterations: 0,
      si_setting_goal: true,
      si_setting_benchmark: true,
      si_setting_harness: true,
      best_score: null,
      current_milestone: null,
      current_phase: null,
      plateau_consecutive_count: 0,
      circuit_breaker_count: 0,
      status: 'running',
      continuation: { planner_id: null, streak: 0, notebook_path: null },
      retrospection_state: { last_round: null, reshaped: false, reshape_trigger_round: null },
      recent_winners: [],
      hybrid_stats: { total: 0, wins: 0, skips: 0 },
    });
    // Write user settings as raw corrupt JSON (not parseable by JSON.parse)
    const userSettingsFile = userSettingsPath(tmpDir);
    fs.mkdirSync(path.dirname(userSettingsFile), { recursive: true });
    fs.writeFileSync(userSettingsFile, '{ "si_claude_setting": true, CORRUPT_JSON }', 'utf8');
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return configuration_error action when user settings contain corrupt JSON', async () => {
    // Arrange -- user_defined/settings.json contains invalid JSON
    // (seeded in before())

    // Act
    const result = await handler(SESSION_PAYLOAD, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.action,
      'configuration_error',
      'action must be "configuration_error" when user settings JSON is corrupt'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6: preserves continuation planner when teammate is alive in registry
// ---------------------------------------------------------------------------

describe('handler -- alive continuation planner', () => {
  let tmpDir;
  const ALIVE_PLANNER_ID = 'agent-continuation-planner-007';

  before(() => {
    tmpDir = makeTmpDir();
    // Agent settings reference a continuation planner that IS present in the
    // registry with status="active" -- the planner is alive
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 7,
        status: 'in_progress',
        current_step: 'planning',
      },
      agentSettings: {
        continuation: {
          planner_id: ALIVE_PLANNER_ID,
          streak: 2,
          notebook_path: 'docs/agent_defined/notebook.json',
        },
      },
      registry: {
        teammates: [
          {
            id: ALIVE_PLANNER_ID,
            role: 'continuation',
            status: 'active',
            session_id: 'sess-planner-007',
            started_at: '2026-04-15T06:00:00.000Z',
          },
        ],
        updated_at: '2026-04-15T08:00:00.000Z',
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should preserve continuation planner_id when teammate is alive in registry', async () => {
    // Arrange -- continuation.planner_id is set AND the id appears in the registry
    // with status="active"
    // (seeded in before())

    // Act
    const result = await handler(SESSION_PAYLOAD, tmpDir);

    // Assert -- returned action must expose the preserved planner_id unchanged
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.continuation_planner_id,
      ALIVE_PLANNER_ID,
      'continuation_planner_id must be preserved when the planner is alive in the registry'
    );

    // Also verify the agent settings file on disk was NOT mutated
    const settingsOnDisk = JSON.parse(fs.readFileSync(agentSettingsPath(tmpDir), 'utf8'));
    assert.equal(
      settingsOnDisk.continuation.planner_id,
      ALIVE_PLANNER_ID,
      'continuation.planner_id in agent_defined/settings.json must remain unchanged'
    );
  });
});
