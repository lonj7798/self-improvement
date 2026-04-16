/**
 * state-io.test.mjs
 * RED phase tests for self-improvement/hooks/lib/state-io.mjs
 * All 17 tests must FAIL until the implementation file is created.
 *
 * Run: node --test self-improvement/hooks/lib/__tests__/state-io.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Import from the module that does NOT exist yet — this is the RED phase.
// Every test will fail at module-load time with ERR_MODULE_NOT_FOUND.
import {
  readJSON,
  writeJSON,
  readIterationState,
  writeIterationState,
  readAgentSettings,
  writeAgentSettings,
  readUserSettings,
  validateSchema,
  backupFile,
} from '../state-io.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a unique temporary directory for each describe group so tests are
 * fully isolated regardless of execution order.
 */
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'state-io-test-'));
}

/**
 * Recursively remove a directory (Node 14+ compatible).
 */
function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Minimal valid iteration_state object matching iteration_state.json on disk.
 */
const VALID_ITERATION_STATE = {
  iteration: 1,
  status: 'in_progress',
  current_step: 'research',
  started_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T01:00:00.000Z',
  research: {
    status: 'pending',
    output_path: null,
    completed_at: null,
  },
  planning: {
    status: 'pending',
    plans: {},
    approved_count: 0,
    completed_at: null,
  },
  execution: {
    status: 'pending',
    executors: {},
    completed_at: null,
  },
  tournament: {
    status: 'pending',
    winner: null,
    winner_score: null,
    completed_at: null,
  },
  recording: {
    status: 'pending',
    history_path: null,
    visualization_updated: false,
    cleanup_done: false,
  },
  user_ideas_consumed: [],
};

/**
 * Minimal valid agent_settings object matching docs/agent_defined/settings.json.
 */
const VALID_AGENT_SETTINGS = {
  iterations: 0,
  si_setting_goal: false,
  si_setting_benchmark: false,
  si_setting_harness: false,
  best_score: null,
  current_milestone: null,
  current_phase: null,
  plateau_consecutive_count: 0,
  circuit_breaker_count: 0,
  status: 'idle',
};

/**
 * Minimal valid user_settings object matching docs/user_defined/settings.json.
 */
const VALID_USER_SETTINGS = {
  si_claude_setting: false,
  number_of_agents: 3,
  number_of_max_critics: 3,
  current_repo_url: '',
  fork_url: '',
  upstream_url: '',
  target_branch: 'main',
  benchmark_command: '',
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
};

/**
 * Minimal valid notebook object (schema from Phase 2 docs).
 */
const VALID_NOTEBOOK = {
  planner_id: null,
  rounds_active: [],
  streak: 0,
  observations: [],
  dead_ends: [],
  current_theory: null,
};

/**
 * Minimal valid teammate_registry object (schema from Phase 2 docs).
 */
const VALID_TEAMMATE_REGISTRY = {
  teammates: [],
  updated_at: null,
};

// ---------------------------------------------------------------------------
// Tests: readJSON
// ---------------------------------------------------------------------------

describe('readJSON', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return parsed object when file contains valid JSON', () => {
    // Arrange
    const filePath = path.join(tmpDir, 'valid.json');
    const expected = { name: 'jane@example.com', count: 42, nested: { ok: true } };
    fs.writeFileSync(filePath, JSON.stringify(expected), 'utf8');

    // Act
    const result = readJSON(filePath);

    // Assert
    assert.deepEqual(result, expected);
  });

  it('should return null when file does not exist', () => {
    // Arrange
    const filePath = path.join(tmpDir, 'does-not-exist.json');

    // Act
    const result = readJSON(filePath);

    // Assert
    assert.equal(result, null);
  });

  it('should return null when file contains corrupt JSON', () => {
    // Arrange
    const filePath = path.join(tmpDir, 'corrupt.json');
    fs.writeFileSync(filePath, '{ "key": "value", INVALID }', 'utf8');

    // Act
    const result = readJSON(filePath);

    // Assert
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// Tests: writeJSON
// ---------------------------------------------------------------------------

describe('writeJSON', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should create file with correct JSON content', () => {
    // Arrange
    const filePath = path.join(tmpDir, 'output.json');
    const data = { iteration: 3, status: 'completed', scores: [1.1, 2.2] };

    // Act
    writeJSON(filePath, data);

    // Assert
    assert.ok(fs.existsSync(filePath), 'file should exist after writeJSON');
    const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.deepEqual(written, data);
  });

  it('should not leave a .tmp file on disk after atomic write', () => {
    // Arrange
    const filePath = path.join(tmpDir, 'atomic.json');
    const data = { benchmark_score: 0.987 };

    // Act
    writeJSON(filePath, data);

    // Assert — no leftover temp file
    const tmpFile = `${filePath}.tmp`;
    assert.ok(!fs.existsSync(tmpFile), '.tmp file must not remain after writeJSON completes');
    // Final file must exist and be correct
    assert.ok(fs.existsSync(filePath), 'final file must exist');
    const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.deepEqual(written, data);
  });
});

// ---------------------------------------------------------------------------
// Tests: readIterationState
// ---------------------------------------------------------------------------

describe('readIterationState', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Create the directory structure that readIterationState expects
    fs.mkdirSync(path.join(tmpDir, 'docs', 'agent_defined'), { recursive: true });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return object with all default fields when state file is missing', () => {
    // Arrange — no iteration_state.json in tmpDir

    // Act
    const result = readIterationState(tmpDir);

    // Assert — all top-level fields must be present with defaults
    assert.ok(result !== null, 'should not return null');
    assert.equal(typeof result.iteration, 'number');
    assert.ok('status' in result);
    assert.ok('current_step' in result);
    assert.ok('started_at' in result);
    assert.ok('updated_at' in result);
    assert.ok('research' in result);
    assert.ok('planning' in result);
    assert.ok('execution' in result);
    assert.ok('tournament' in result);
    assert.ok('recording' in result);
    assert.ok(Array.isArray(result.user_ideas_consumed));
  });

  it('should merge existing data with defaults when file has partial content', () => {
    // Arrange — write a partial state file
    const stateDir = path.join(tmpDir, 'docs', 'agent_defined');
    const filePath = path.join(stateDir, 'iteration_state.json');
    const partial = {
      iteration: 5,
      status: 'in_progress',
      current_step: 'execution',
    };
    fs.writeFileSync(filePath, JSON.stringify(partial), 'utf8');

    // Act
    const result = readIterationState(tmpDir);

    // Assert — existing fields preserved
    assert.equal(result.iteration, 5);
    assert.equal(result.status, 'in_progress');
    assert.equal(result.current_step, 'execution');
    // Missing fields filled with defaults
    assert.ok('research' in result);
    assert.ok('planning' in result);
    assert.ok('execution' in result);
    assert.ok('tournament' in result);
    assert.ok('recording' in result);
  });
});

// ---------------------------------------------------------------------------
// Tests: writeIterationState
// ---------------------------------------------------------------------------

describe('writeIterationState', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    fs.mkdirSync(path.join(tmpDir, 'docs', 'agent_defined'), { recursive: true });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should merge updates and preserve untouched fields', () => {
    // Arrange — write an initial full state
    const stateDir = path.join(tmpDir, 'docs', 'agent_defined');
    const filePath = path.join(stateDir, 'iteration_state.json');
    fs.writeFileSync(filePath, JSON.stringify(VALID_ITERATION_STATE), 'utf8');

    // Act — only update status and current_step
    writeIterationState(tmpDir, { status: 'completed', current_step: 'stop_check' });

    // Assert — updated fields changed
    const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(result.status, 'completed');
    assert.equal(result.current_step, 'stop_check');
    // Untouched fields preserved
    assert.equal(result.iteration, VALID_ITERATION_STATE.iteration);
    assert.deepEqual(result.research, VALID_ITERATION_STATE.research);
    assert.deepEqual(result.user_ideas_consumed, VALID_ITERATION_STATE.user_ideas_consumed);
  });
});

// ---------------------------------------------------------------------------
// Tests: readAgentSettings
// ---------------------------------------------------------------------------

describe('readAgentSettings', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const settingsDir = path.join(tmpDir, 'docs', 'agent_defined');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(VALID_AGENT_SETTINGS),
      'utf8'
    );
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return object with all expected agent settings fields', () => {
    // Act
    const result = readAgentSettings(tmpDir);

    // Assert — all required fields present
    assert.ok(result !== null);
    assert.equal(typeof result.iterations, 'number');
    assert.ok('si_setting_goal' in result);
    assert.ok('si_setting_benchmark' in result);
    assert.ok('si_setting_harness' in result);
    assert.ok('best_score' in result);
    assert.ok('current_milestone' in result);
    assert.ok('current_phase' in result);
    assert.equal(typeof result.plateau_consecutive_count, 'number');
    assert.equal(typeof result.circuit_breaker_count, 'number');
    assert.ok('status' in result);
  });
});

// ---------------------------------------------------------------------------
// Tests: writeAgentSettings
// ---------------------------------------------------------------------------

describe('writeAgentSettings', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const settingsDir = path.join(tmpDir, 'docs', 'agent_defined');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(VALID_AGENT_SETTINGS),
      'utf8'
    );
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should merge updates and preserve untouched agent settings fields', () => {
    // Arrange
    const update = { iterations: 7, status: 'running', best_score: 0.912 };

    // Act
    writeAgentSettings(tmpDir, update);

    // Assert — updated fields changed
    const filePath = path.join(tmpDir, 'docs', 'agent_defined', 'settings.json');
    const result = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(result.iterations, 7);
    assert.equal(result.status, 'running');
    assert.equal(result.best_score, 0.912);
    // Untouched fields preserved
    assert.equal(result.si_setting_goal, VALID_AGENT_SETTINGS.si_setting_goal);
    assert.equal(result.number_of_agents, VALID_AGENT_SETTINGS.number_of_agents);
    assert.equal(result.plateau_consecutive_count, VALID_AGENT_SETTINGS.plateau_consecutive_count);
  });
});

// ---------------------------------------------------------------------------
// Tests: readUserSettings
// ---------------------------------------------------------------------------

describe('readUserSettings', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const settingsDir = path.join(tmpDir, 'docs', 'user_defined');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(VALID_USER_SETTINGS),
      'utf8'
    );
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return object with all expected user settings fields', () => {
    // Act
    const result = readUserSettings(tmpDir);

    // Assert — all required fields present
    assert.ok(result !== null);
    assert.ok('si_claude_setting' in result);
    assert.equal(typeof result.number_of_agents, 'number');
    assert.equal(typeof result.number_of_max_critics, 'number');
    assert.ok('current_repo_url' in result);
    assert.ok('fork_url' in result);
    assert.ok('upstream_url' in result);
    assert.ok('target_branch' in result);
    assert.ok('benchmark_command' in result);
    assert.ok('benchmark_format' in result);
    assert.ok('benchmark_direction' in result);
    assert.equal(typeof result.max_iterations, 'number');
    assert.ok('plateau_threshold' in result);
    assert.ok('plateau_window' in result);
    assert.ok('target_value' in result);
    assert.ok('primary_metric' in result);
    assert.ok(Array.isArray(result.sealed_files));
    assert.ok('regression_threshold' in result);
    assert.ok('circuit_breaker_threshold' in result);
  });
});

// ---------------------------------------------------------------------------
// Tests: validateSchema
// ---------------------------------------------------------------------------

describe('validateSchema', () => {
  it('should return valid=true and empty errors for a valid iteration_state object', () => {
    // Act
    const result = validateSchema('iteration_state', VALID_ITERATION_STATE);

    // Assert
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('should return valid=false and non-empty errors for iteration_state missing required fields', () => {
    // Arrange — object missing all required fields
    const invalid = { iteration: 1 };

    // Act
    const result = validateSchema('iteration_state', invalid);

    // Assert
    assert.equal(result.valid, false);
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.length > 0, 'errors array must be non-empty for invalid object');
  });

  it('should return valid=true for a valid agent_settings object', () => {
    // Act
    const result = validateSchema('agent_settings', VALID_AGENT_SETTINGS);

    // Assert
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('should return valid=true for a valid notebook object', () => {
    // Act
    const result = validateSchema('notebook', VALID_NOTEBOOK);

    // Assert
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('should return valid=true for a valid teammate_registry object', () => {
    // Act
    const result = validateSchema('teammate_registry', VALID_TEAMMATE_REGISTRY);

    // Assert
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });
});

// ---------------------------------------------------------------------------
// Tests: backupFile
// ---------------------------------------------------------------------------

describe('backupFile', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should create a copy in .backup/ subdirectory with content matching the original', () => {
    // Arrange
    const original = path.join(tmpDir, 'settings.json');
    const originalContent = JSON.stringify({ status: 'idle', iterations: 12 });
    fs.writeFileSync(original, originalContent, 'utf8');

    // Act
    const backupPath = backupFile(original);

    // Assert — backup file exists
    assert.ok(fs.existsSync(backupPath), 'backup file must exist');
    // Backup is in .backup/ subdirectory of the same directory
    const backupDir = path.join(tmpDir, '.backup');
    assert.ok(
      backupPath.startsWith(backupDir),
      `backup path "${backupPath}" must be inside "${backupDir}"`
    );
    // Backup content matches original
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    assert.equal(backupContent, originalContent);
    // Backup filename includes a timestamp suffix (not identical to original basename)
    const backupBasename = path.basename(backupPath);
    assert.notEqual(backupBasename, path.basename(original));
  });
});
