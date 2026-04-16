/**
 * si-state-validator.test.mjs
 * RED phase tests for Task 5.7: si-state-validator.mjs (PostToolUse hook)
 *
 * All 8 tests FAIL until the implementation file is created.
 *
 * Run: node --test hooks/__tests__/si-state-validator.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 *
 * Handler signature:
 *   export default async function handler(payload, projectRoot)
 *
 * Payload shape:
 *   { tool_name: 'Write' | 'Edit', file_path: <absolute path of the written file> }
 *
 * Target files (matched by suffix against projectRoot):
 *   docs/user_defined/settings.json
 *   docs/agent_defined/settings.json
 *   docs/agent_defined/notebook.json
 *
 * Behaviour contract:
 *   - For target files: backup to .backup/ first, then validate schema.
 *   - Invalid JSON or schema failure: revert file from the backup.
 *   - agent_defined/settings.json only: also enforce counter monotonicity
 *     (iterations field must not decrease).
 *   - user_defined/settings.json only: warn when sealed_files is emptied
 *     while status is "running".
 *   - Non-target files: silently return without any action.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Import from the module that does NOT exist yet -- this is the RED phase.
// Every test will fail at module-load time with ERR_MODULE_NOT_FOUND.
// ---------------------------------------------------------------------------
import handler from '../si-state-validator.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an isolated temporary directory that mirrors the expected project
 * directory layout used by state-io.mjs helpers:
 *   <tmp>/docs/user_defined/
 *   <tmp>/docs/agent_defined/
 */
function makeProjectDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'si-state-validator-'));
  fs.mkdirSync(path.join(root, 'docs', 'user_defined'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'agent_defined'), { recursive: true });
  return root;
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function readFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Find all files inside a .backup/ sub-directory of the given file's parent. */
function listBackups(filePath) {
  const backupDir = path.join(path.dirname(filePath), '.backup');
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir).filter((f) => f.startsWith(path.basename(filePath)));
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

/** Minimal valid user_defined/settings.json */
const VALID_USER_SETTINGS = {
  si_claude_setting: true,
  number_of_agents: 3,
  number_of_max_critics: 2,
  current_repo_url: 'https://github.com/example/repo',
  fork_url: 'https://github.com/example/fork',
  upstream_url: 'https://github.com/example/repo',
  target_branch: 'main',
  benchmark_command: 'python3 bench.py',
  benchmark_format: 'json',
  benchmark_direction: 'higher_is_better',
  max_iterations: 10,
  plateau_threshold: 0.01,
  plateau_window: 3,
  target_value: null,
  primary_metric: 'primary',
  sealed_files: ['src/model.py'],
  regression_threshold: null,
  circuit_breaker_threshold: 5,
  hybrid_planner: { enabled: false, skip_when_all_diverse: true, redundancy_threshold_pct: 80 },
  de_risk: { enabled: true, timeout_seconds: 60, reduced_dataset_flag: '--subset 32' },
  simplicity: { max_lines_added: 200, threshold_pct: 5, tiebreak_by_lines: true },
  retrospection: { enabled: true, interval: 3, plateau_reshape_rounds: 1, near_miss_threshold_pct: 2, failure_rate_threshold_pct: 50, family_concentration_window: 3 },
};

/** Minimal valid agent_defined/settings.json */
const VALID_AGENT_SETTINGS = {
  iterations: 2,
  si_setting_goal: true,
  si_setting_benchmark: true,
  si_setting_harness: true,
  best_score: 0.85,
  current_milestone: null,
  current_phase: null,
  plateau_consecutive_count: 0,
  circuit_breaker_count: 0,
  status: 'running',
  continuation: { planner_id: null, streak: 0, notebook_path: null },
  retrospection_state: { last_round: null, reshaped: false, reshape_trigger_round: null },
  recent_winners: [],
  hybrid_stats: { total: 0, wins: 0, skips: 0 },
};

/** Minimal valid notebook.json */
const VALID_NOTEBOOK = {
  planner_id: 'planner_a',
  rounds_active: [1, 2],
  streak: 2,
  observations: ['model converges faster with lr=1e-4'],
  dead_ends: [],
  current_theory: 'learning rate schedule is the key lever',
};

// ---------------------------------------------------------------------------
// Test 1: passes valid user settings write — no revert, backup created
// ---------------------------------------------------------------------------

describe('handler — valid user settings write', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should pass without reverting when user settings are valid JSON with correct schema', async () => {
    // Arrange — write a valid user settings file to disk
    const settingsPath = path.join(projectRoot, 'docs', 'user_defined', 'settings.json');
    writeFile(settingsPath, VALID_USER_SETTINGS);

    const payload = {
      tool_name: 'Write',
      file_path: settingsPath,
    };

    // Act
    await handler(payload, projectRoot);

    // Assert — file content must remain identical to what was written
    const after = readFile(settingsPath);
    assert.deepEqual(
      after,
      VALID_USER_SETTINGS,
      'Valid user settings must not be reverted by the validator'
    );

    // Assert — a backup must have been created in the .backup/ sibling directory
    const backups = listBackups(settingsPath);
    assert.ok(
      backups.length > 0,
      'handler must create a backup of the file before validating'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2: reverts invalid user settings from backup
// ---------------------------------------------------------------------------

describe('handler — invalid user settings revert', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should revert user settings from backup when the written content is corrupt JSON', async () => {
    // Arrange — write a known-good backup first, then overwrite with corrupt content
    const settingsPath = path.join(projectRoot, 'docs', 'user_defined', 'settings.json');

    // Write valid settings so a backup can be taken from them
    writeFile(settingsPath, VALID_USER_SETTINGS);

    // Simulate the PostToolUse hook firing for the valid write (creates a valid backup)
    await handler({ tool_name: 'Write', file_path: settingsPath }, projectRoot);

    // Simulate a corrupt write: overwrite with invalid JSON
    fs.writeFileSync(settingsPath, '{ this is not valid json !!!', 'utf8');

    const payload = {
      tool_name: 'Write',
      file_path: settingsPath,
    };

    // Act — handler must detect corruption and restore from the last valid backup
    await handler(payload, projectRoot);

    // Assert — the file on disk must now be the valid backup content, not the corrupt bytes
    let restoredContent;
    try {
      restoredContent = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      assert.fail('After revert, settings.json must be valid JSON but it is not parseable');
    }

    assert.deepEqual(
      restoredContent,
      VALID_USER_SETTINGS,
      'handler must restore the last valid backup when user settings are corrupt'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: passes valid agent settings write — no revert, backup created
// ---------------------------------------------------------------------------

describe('handler — valid agent settings write', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should pass without reverting when agent settings are valid JSON with correct schema', async () => {
    // Arrange
    const settingsPath = path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
    writeFile(settingsPath, VALID_AGENT_SETTINGS);

    const payload = {
      tool_name: 'Write',
      file_path: settingsPath,
    };

    // Act
    await handler(payload, projectRoot);

    // Assert — content unchanged
    const after = readFile(settingsPath);
    assert.equal(
      after.iterations,
      VALID_AGENT_SETTINGS.iterations,
      'Valid agent settings must not be reverted by the validator'
    );
    assert.equal(
      after.status,
      VALID_AGENT_SETTINGS.status,
      'Valid agent settings must not be reverted by the validator'
    );

    // Assert — backup exists
    const backups = listBackups(settingsPath);
    assert.ok(
      backups.length > 0,
      'handler must create a backup of agent settings before validating'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4: reverts invalid agent settings from backup
// ---------------------------------------------------------------------------

describe('handler — invalid agent settings revert', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should revert agent settings from backup when written content fails schema validation', async () => {
    // Arrange — write valid settings first, then overwrite with schema-invalid content
    const settingsPath = path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
    writeFile(settingsPath, VALID_AGENT_SETTINGS);

    // Simulate the PostToolUse hook firing for the valid write (creates a valid backup)
    await handler({ tool_name: 'Write', file_path: settingsPath }, projectRoot);

    // Overwrite with JSON that is syntactically valid but schema-invalid:
    // missing required fields like iterations, status, plateau_consecutive_count, etc.
    const badSettings = { arbitrary_garbage_key: true };
    writeFile(settingsPath, badSettings);

    const payload = {
      tool_name: 'Write',
      file_path: settingsPath,
    };

    // Act
    await handler(payload, projectRoot);

    // Assert — file must be restored to the last valid content
    const restoredContent = readFile(settingsPath);
    assert.equal(
      restoredContent.iterations,
      VALID_AGENT_SETTINGS.iterations,
      'handler must restore agent settings from backup when schema validation fails'
    );
    assert.equal(
      restoredContent.status,
      VALID_AGENT_SETTINGS.status,
      'handler must restore agent settings from backup when schema validation fails'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: verifies counter monotonicity (iterations never decreases)
// ---------------------------------------------------------------------------

describe('handler — counter monotonicity enforcement', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should revert agent settings from backup when iterations field decreases', async () => {
    // Arrange — write valid settings with iterations=5 as the known-good baseline
    const settingsPath = path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
    const originalSettings = { ...VALID_AGENT_SETTINGS, iterations: 5 };
    writeFile(settingsPath, originalSettings);

    // Simulate the PostToolUse hook firing for the valid write (creates a valid backup)
    await handler({ tool_name: 'Write', file_path: settingsPath }, projectRoot);

    // Overwrite with settings where iterations went backwards to 3
    const decreasedSettings = { ...VALID_AGENT_SETTINGS, iterations: 3 };
    writeFile(settingsPath, decreasedSettings);

    const payload = {
      tool_name: 'Write',
      file_path: settingsPath,
    };

    // Act
    await handler(payload, projectRoot);

    // Assert — the decrease must have been caught and the file reverted
    const onDisk = readFile(settingsPath);
    assert.equal(
      onDisk.iterations,
      5,
      'handler must revert agent settings when iterations decreases (monotonicity violation)'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6: creates backup before validation
// ---------------------------------------------------------------------------

describe('handler — backup created before validation', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should create a .backup/ file before running validation on a target file', async () => {
    // Arrange — write valid notebook to disk
    const notebookPath = path.join(projectRoot, 'docs', 'agent_defined', 'notebook.json');
    writeFile(notebookPath, VALID_NOTEBOOK);

    // Confirm no backup exists yet
    const beforeBackups = listBackups(notebookPath);
    assert.equal(beforeBackups.length, 0, 'No backup should exist before handler is called');

    const payload = {
      tool_name: 'Write',
      file_path: notebookPath,
    };

    // Act
    await handler(payload, projectRoot);

    // Assert — backup must now exist in <parent>/.backup/
    const afterBackups = listBackups(notebookPath);
    assert.ok(
      afterBackups.length > 0,
      'handler must create a backup in .backup/ before running validation'
    );

    // Assert — backup file must contain the correct pre-validation content
    const backupDir = path.join(path.dirname(notebookPath), '.backup');
    const backupFile = path.join(backupDir, afterBackups[0]);
    const backupContent = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    assert.equal(
      backupContent.planner_id,
      VALID_NOTEBOOK.planner_id,
      'Backup file must contain the content that existed before validation ran'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 7: passes valid notebook write — no revert, backup created
// ---------------------------------------------------------------------------

describe('handler — valid notebook write', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should pass without reverting when notebook JSON has correct schema', async () => {
    // Arrange
    const notebookPath = path.join(projectRoot, 'docs', 'agent_defined', 'notebook.json');
    writeFile(notebookPath, VALID_NOTEBOOK);

    const payload = {
      tool_name: 'Write',
      file_path: notebookPath,
    };

    // Act
    await handler(payload, projectRoot);

    // Assert — content must be unchanged
    const after = readFile(notebookPath);
    assert.equal(
      after.planner_id,
      VALID_NOTEBOOK.planner_id,
      'Valid notebook content must not be reverted'
    );
    assert.equal(
      after.streak,
      VALID_NOTEBOOK.streak,
      'Valid notebook content must not be reverted'
    );

    // Assert — backup created
    const backups = listBackups(notebookPath);
    assert.ok(
      backups.length > 0,
      'handler must create a backup of notebook.json before validating'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 8: ignores writes to non-critical files
// ---------------------------------------------------------------------------

describe('handler — non-critical file is ignored', () => {
  let projectRoot;

  before(() => {
    projectRoot = makeProjectDir();
  });

  after(() => {
    rmrf(projectRoot);
  });

  it('should take no action when the written file is not a monitored target', async () => {
    // Arrange — write an arbitrary JSON file that is NOT a monitored target
    const randomPath = path.join(projectRoot, 'docs', 'agent_defined', 'research_briefs', 'round_1.json');
    fs.mkdirSync(path.dirname(randomPath), { recursive: true });
    const arbitraryContent = { idea: 'some research result', confidence: 0.9 };
    writeFile(randomPath, arbitraryContent);

    const payload = {
      tool_name: 'Write',
      file_path: randomPath,
    };

    // Act — handler must return without doing anything
    await handler(payload, projectRoot);

    // Assert — file content must be exactly what was written (not touched)
    const after = readFile(randomPath);
    assert.deepEqual(
      after,
      arbitraryContent,
      'handler must not modify non-target files'
    );

    // Assert — no backup must be created for non-target files
    const backups = listBackups(randomPath);
    assert.equal(
      backups.length,
      0,
      'handler must not create .backup/ entries for non-target files'
    );
  });
});
