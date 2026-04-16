/**
 * si-state-flush.test.mjs
 * RED phase tests for Task 5.4: hooks/si-state-flush.mjs (PreCompact hook)
 *
 * All 5 tests FAIL until the implementation file is created.
 * Expected failure reason: ERR_MODULE_NOT_FOUND (si-state-flush.mjs does not exist)
 *
 * Run: node --test hooks/__tests__/si-state-flush.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 *
 * Handler signature:
 *   export default async function handler(payload, projectRoot)
 *   payload: { hook_event_name: "PreCompact", ... }
 *   projectRoot: absolute path to the self-improvement project root
 *
 * Known limitation (from plan Task 5.4):
 *   Hooks CANNOT call Claude Code APIs (SendMessage, TeamCreate, etc.).
 *   This hook uses a file-based mechanism only:
 *     1. Force-write iteration_state.json (refresh updated_at)
 *     2. Set compaction_pending: true in iteration_state when continuation active
 *     3. Flush recent_winners to agent_defined/settings.json
 *   The hook does NOT modify notebook.json -- the orchestrator handles that
 *   after reading the compaction_pending flag.
 *
 * Tests use isolated temp dirs -- no shared mutable state between tests.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Import the module that does NOT exist yet -- RED phase.
// Every test fails at import time with ERR_MODULE_NOT_FOUND.
// ---------------------------------------------------------------------------
import handler from '../si-state-flush.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a unique temporary directory for one test group, fully isolated.
 */
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'si-state-flush-test-'));
}

/**
 * Recursively remove a directory (cleanup after each test group).
 */
function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Write a JSON file at the given absolute path, creating parent dirs as needed.
 */
function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Read and parse a JSON file. Returns the parsed object.
 */
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Canonical path helpers matching state-io.mjs conventions */
function iterationStatePath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'iteration_state.json');
}

function agentSettingsPath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
}

function notebookPath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'notebook.json');
}

/**
 * Seed a project root with complete, realistic state files.
 * Caller overrides only the fields relevant to their test.
 */
function seedProjectRoot(projectRoot, {
  iterationState = {},
  agentSettings = {},
  notebook = null,
} = {}) {
  // docs/agent_defined/iteration_state.json
  writeJSON(iterationStatePath(projectRoot), {
    iteration: 2,
    status: 'in_progress',
    current_step: 'planning',
    started_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-15T08:10:00.000Z',
    research:   { status: 'completed', output_path: 'docs/agent_defined/research_briefs/round_2.json', completed_at: '2026-04-15T08:05:00.000Z' },
    planning:   { status: 'in_progress', plans: {}, approved_count: 0, completed_at: null },
    execution:  { status: 'pending', executors: {}, completed_at: null },
    tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
    recording:  { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
    user_ideas_consumed: [],
    ...iterationState,
  });

  // docs/agent_defined/settings.json
  writeJSON(agentSettingsPath(projectRoot), {
    iterations: 1,
    si_setting_goal: true,
    si_setting_benchmark: true,
    si_setting_harness: true,
    best_score: 42.5,
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

  // docs/agent_defined/notebook.json (optional -- only some tests need it)
  if (notebook !== null) {
    writeJSON(notebookPath(projectRoot), notebook);
  }
}

// Minimal payload -- PreCompact hooks receive compaction context but the
// handler under test only uses projectRoot for state file discovery.
const PRECOMPACT_PAYLOAD = {
  hook_event_name: 'PreCompact',
};

// ---------------------------------------------------------------------------
// Test 1: writes iteration_state.json with current progress
// ---------------------------------------------------------------------------
// The hook must unconditionally force-write iteration_state.json, refreshing
// updated_at to the current time so the orchestrator sees the latest state
// after compaction resumes.
// ---------------------------------------------------------------------------

describe('handler -- writes iteration_state.json with current progress', () => {
  let tmpDir;
  const FIXED_BEFORE = '2026-04-15T08:10:00.000Z';

  before(() => {
    tmpDir = makeTmpDir();
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 3,
        status: 'in_progress',
        current_step: 'execution',
        updated_at: FIXED_BEFORE,
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should write iteration_state.json and refresh updated_at when handler runs', async () => {
    // Arrange
    const statePath = iterationStatePath(tmpDir);
    const beforeTimestamp = FIXED_BEFORE;

    // Act
    await handler(PRECOMPACT_PAYLOAD, tmpDir);

    // Assert -- file must exist and updated_at must have changed
    assert.ok(fs.existsSync(statePath), 'iteration_state.json must exist after handler runs');
    const written = readJSON(statePath);
    assert.ok(
      written.updated_at !== undefined,
      'written iteration_state.json must have an updated_at field'
    );
    assert.notEqual(
      written.updated_at,
      beforeTimestamp,
      'updated_at must be refreshed (not the same as the value before the flush)'
    );
    // Core iteration fields must be preserved intact
    assert.equal(written.iteration, 3, 'iteration number must be preserved after flush');
    assert.equal(written.current_step, 'execution', 'current_step must be preserved after flush');
  });
});

// ---------------------------------------------------------------------------
// Test 2: sets compaction_pending flag in iteration_state
// ---------------------------------------------------------------------------
// When continuation planner is active (continuation.planner_id is non-null),
// the hook must write compaction_pending: true into iteration_state.json.
// This signals the orchestrator to prompt the planner to flush its notebook
// on its next action -- the hook cannot do it directly (no API access).
// ---------------------------------------------------------------------------

describe('handler -- sets compaction_pending flag when continuation planner active', () => {
  let tmpDir;
  const ACTIVE_PLANNER_ID = 'agent-continuation-planner-007';

  before(() => {
    tmpDir = makeTmpDir();
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 5,
        status: 'in_progress',
        current_step: 'planning',
      },
      agentSettings: {
        continuation: {
          planner_id: ACTIVE_PLANNER_ID,
          streak: 3,
          notebook_path: 'docs/agent_defined/notebook.json',
        },
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should set compaction_pending to true in iteration_state when continuation planner is active', async () => {
    // Arrange -- continuation.planner_id is set (non-null), indicating active planner
    const statePath = iterationStatePath(tmpDir);

    // Act
    await handler(PRECOMPACT_PAYLOAD, tmpDir);

    // Assert
    assert.ok(fs.existsSync(statePath), 'iteration_state.json must exist after handler runs');
    const written = readJSON(statePath);
    assert.strictEqual(
      written.compaction_pending,
      true,
      'iteration_state.compaction_pending must be true when continuation planner is active'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: flushes recent_winners to agent settings
// ---------------------------------------------------------------------------
// The handler must write the current recent_winners array (from the in-memory
// state or the existing settings file) into agent_defined/settings.json so
// that the most up-to-date winner history survives context compaction.
// ---------------------------------------------------------------------------

describe('handler -- flushes recent_winners to agent settings', () => {
  let tmpDir;

  const RECENT_WINNERS = [
    { round: 1, executor_id: 'executor_2', score: 55.1, approach_family: 'gradient_descent' },
    { round: 2, executor_id: 'executor_1', score: 58.7, approach_family: 'ensemble' },
  ];

  before(() => {
    tmpDir = makeTmpDir();
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 3,
        status: 'in_progress',
        current_step: 'execution',
      },
      agentSettings: {
        recent_winners: RECENT_WINNERS,
        continuation: { planner_id: null, streak: 0, notebook_path: null },
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should write recent_winners to agent settings file during flush', async () => {
    // Arrange -- agent settings already has two recent_winners entries
    const settingsPath = agentSettingsPath(tmpDir);

    // Act
    await handler(PRECOMPACT_PAYLOAD, tmpDir);

    // Assert
    assert.ok(fs.existsSync(settingsPath), 'agent settings file must exist after handler runs');
    const written = readJSON(settingsPath);
    assert.ok(
      Array.isArray(written.recent_winners),
      'recent_winners in written settings must be an array'
    );
    assert.equal(
      written.recent_winners.length,
      RECENT_WINNERS.length,
      `recent_winners must have ${RECENT_WINNERS.length} entries after flush`
    );
    assert.deepEqual(
      written.recent_winners[0],
      RECENT_WINNERS[0],
      'first recent_winner entry must match the original value'
    );
    assert.deepEqual(
      written.recent_winners[1],
      RECENT_WINNERS[1],
      'second recent_winner entry must match the original value'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4: preserves existing notebook.json content
// ---------------------------------------------------------------------------
// The hook CANNOT call Claude Code APIs (SendMessage). It must NOT modify
// notebook.json -- that is the orchestrator's responsibility after it reads
// the compaction_pending flag. The hook only sets the flag and flushes
// iteration_state + agent settings via file I/O.
// ---------------------------------------------------------------------------

describe('handler -- preserves existing notebook.json content', () => {
  let tmpDir;

  const NOTEBOOK_CONTENT = {
    planner_id: 'agent-continuation-planner-007',
    rounds_active: [1, 2, 3, 4, 5],
    streak: 5,
    observations: [
      'Gradient-based approaches plateau near 58% -- try ensemble methods.',
      'Round 3 near-miss: off by 0.2% -- worth revisiting with larger dataset.',
    ],
    dead_ends: ['pure_sgd_lr_0.1', 'adam_no_warmup'],
    current_theory: 'Stacking ensemble of diverse families outperforms single-family tuning.',
  };

  before(() => {
    tmpDir = makeTmpDir();
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 5,
        status: 'in_progress',
        current_step: 'planning',
      },
      agentSettings: {
        continuation: {
          planner_id: 'agent-continuation-planner-007',
          streak: 5,
          notebook_path: 'docs/agent_defined/notebook.json',
        },
      },
      notebook: NOTEBOOK_CONTENT,
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should not modify notebook.json because the hook cannot call SendMessage', async () => {
    // Arrange -- notebook.json exists with known content; continuation planner is active
    const nbPath = notebookPath(tmpDir);
    const contentBefore = fs.readFileSync(nbPath, 'utf8');

    // Act
    await handler(PRECOMPACT_PAYLOAD, tmpDir);

    // Assert -- notebook must be byte-for-byte identical after the hook runs
    assert.ok(
      fs.existsSync(nbPath),
      'notebook.json must still exist after handler runs'
    );
    const contentAfter = fs.readFileSync(nbPath, 'utf8');
    assert.equal(
      contentAfter,
      contentBefore,
      'notebook.json content must be unchanged -- the hook cannot call SendMessage to update it'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: handles missing state files gracefully
// ---------------------------------------------------------------------------
// When state files do not exist (fresh project root or files were deleted),
// the handler must not throw. It must complete without crashing and must
// still write what it can -- at minimum, iteration_state.json must be created.
// ---------------------------------------------------------------------------

describe('handler -- handles missing state files gracefully', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Intentionally do NOT seed any state files -- the directory is empty
    // (only the temp dir itself exists, none of the docs/ subdirs)
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should not throw when state files are missing and should write iteration_state', async () => {
    // Arrange -- no state files exist at all
    const statePath = iterationStatePath(tmpDir);
    const settingsPath = agentSettingsPath(tmpDir);
    assert.ok(!fs.existsSync(statePath), 'iteration_state.json must not exist before handler runs');
    assert.ok(!fs.existsSync(settingsPath), 'agent settings must not exist before handler runs');

    // Act -- must not throw
    await assert.doesNotReject(
      () => handler(PRECOMPACT_PAYLOAD, tmpDir),
      'handler must not throw when state files are missing'
    );

    // Assert -- iteration_state.json must be created (best-effort flush)
    assert.ok(
      fs.existsSync(statePath),
      'iteration_state.json must be created by handler even when starting from missing files'
    );
  });
});
