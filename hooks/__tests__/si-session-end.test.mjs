/**
 * si-session-end.test.mjs
 * RED phase tests for Task 5.6: hooks/si-session-end.mjs (SessionEnd hook)
 *
 * All 5 tests FAIL until the implementation file is created.
 * Expected failure reason: ERR_MODULE_NOT_FOUND (si-session-end.mjs does not exist)
 *
 * Run: node --test hooks/__tests__/si-session-end.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 *
 * Handler signature:
 *   export default async function handler(payload, projectRoot)
 *
 * Payload shape (SessionEnd hook):
 *   { session_id: string, hook_event_name: 'SessionEnd' }
 *
 * Files written by the handler:
 *   <projectRoot>/docs/agent_defined/iteration_state.json  -- persisted state
 *   <projectRoot>/docs/agent_defined/settings.json         -- updated timestamps
 *   <projectRoot>/.jaewon/context/handoff.md               -- handoff document
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
import handler from '../si-session-end.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a unique temporary directory per test so tests are fully isolated
 * regardless of execution order.
 */
function makeTmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `si-session-end-${label}-`));
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
function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Write a plain text file, creating parent dirs as needed.
 */
function writeTextFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

/**
 * Canonical path helpers -- mirrors the layout expected by state-io.mjs.
 */
function iterationStatePath(root) {
  return path.join(root, 'docs', 'agent_defined', 'iteration_state.json');
}

function agentSettingsPath(root) {
  return path.join(root, 'docs', 'agent_defined', 'settings.json');
}

function handoffPath(root) {
  return path.join(root, '.jaewon', 'context', 'handoff.md');
}

/**
 * Seed a minimal but realistic project root.
 * Each test only overrides the fields it cares about.
 */
function seedProjectRoot(root, {
  iterationState = {},
  agentSettings = {},
} = {}) {
  writeJsonFile(iterationStatePath(root), {
    iteration: 1,
    status: 'in_progress',
    current_step: 'research',
    started_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-15T08:30:00.000Z',
    research:   { status: 'in_progress', output_path: null, completed_at: null },
    planning:   { status: 'pending', plans: {}, approved_count: 0, completed_at: null },
    execution:  { status: 'pending', executors: {}, completed_at: null },
    tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
    recording:  { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
    user_ideas_consumed: [],
    ...iterationState,
  });

  writeJsonFile(agentSettingsPath(root), {
    iterations: 2,
    si_setting_goal: true,
    si_setting_benchmark: true,
    si_setting_harness: true,
    best_score: 0.74,
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
}

// ---------------------------------------------------------------------------
// Shared minimal SessionEnd payload.
// The handler only uses projectRoot for file I/O; payload carries session info.
// ---------------------------------------------------------------------------
const SESSION_END_PAYLOAD = {
  session_id: 'sess-end-test-001',
  hook_event_name: 'SessionEnd',
};

// ---------------------------------------------------------------------------
// Test 1: writes iteration_state.json with current progress
// ---------------------------------------------------------------------------

describe('si-session-end handler -- writes iteration_state.json', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir('iter-state');
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 4,
        status: 'in_progress',
        current_step: 'execution',
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should write iteration_state.json with current progress when session ends', async () => {
    // Arrange -- iteration_state has iteration=4, current_step=execution
    // (seeded in before())
    const statePath = iterationStatePath(tmpDir);
    const originalMtime = fs.statSync(statePath).mtimeMs;

    // Act
    await handler(SESSION_END_PAYLOAD, tmpDir);

    // Assert -- the file must have been written (mtime advanced or content valid)
    assert.ok(
      fs.existsSync(statePath),
      'iteration_state.json must exist after handler runs'
    );
    const written = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(
      written.iteration,
      4,
      'iteration field must be preserved in the written state file'
    );
    assert.equal(
      written.current_step,
      'execution',
      'current_step must be preserved in the written state file'
    );
    assert.ok(
      typeof written.updated_at === 'string' && written.updated_at.length > 0,
      'updated_at must be a non-empty ISO string after the handler writes the file'
    );
    // The handler must have touched the file (timestamp or content updated)
    const newMtime = fs.statSync(statePath).mtimeMs;
    assert.ok(
      newMtime >= originalMtime,
      'iteration_state.json file must be written by the handler (mtime must not go backwards)'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2: writes handoff.md with session summary
// ---------------------------------------------------------------------------

describe('si-session-end handler -- writes handoff.md', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir('handoff');
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 7,
        status: 'in_progress',
        current_step: 'planning',
      },
      agentSettings: {
        iterations: 6,
        best_score: 0.82,
        continuation: {
          planner_id: 'agent-continuation-planner-007',
          streak: 3,
          notebook_path: 'docs/agent_defined/notebook.json',
        },
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should write handoff.md containing iteration, step, planner id, and best score', async () => {
    // Arrange -- iteration=7, step=planning, continuation planner set, best_score=0.82
    // (seeded in before())

    // Act
    await handler(SESSION_END_PAYLOAD, tmpDir);

    // Assert -- handoff.md must exist and contain the required summary fields
    const hPath = handoffPath(tmpDir);
    assert.ok(
      fs.existsSync(hPath),
      '.jaewon/context/handoff.md must be created by the handler'
    );

    const content = fs.readFileSync(hPath, 'utf8');

    // Must reference the current iteration number
    assert.ok(
      content.includes('7'),
      'handoff.md must include the current iteration number (7)'
    );

    // Must reference the current step
    assert.ok(
      content.toLowerCase().includes('planning'),
      'handoff.md must include the current step ("planning")'
    );

    // Must reference the continuation planner id
    assert.ok(
      content.includes('agent-continuation-planner-007'),
      'handoff.md must include the continuation planner id'
    );

    // Must reference the best score
    assert.ok(
      content.includes('0.82'),
      'handoff.md must include the best score (0.82)'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: updates agent settings timestamps
// ---------------------------------------------------------------------------

describe('si-session-end handler -- updates agent settings timestamps', () => {
  let tmpDir;
  let beforeTime;

  before(() => {
    tmpDir = makeTmpDir('timestamps');
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 2,
        status: 'in_progress',
        current_step: 'research',
      },
      agentSettings: {
        iterations: 1,
        best_score: 0.65,
        // No last_end field present yet
      },
    });
    // Record approximate time just before handler runs
    beforeTime = Date.now();
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should update agent settings with a last_end timestamp when session ends', async () => {
    // Arrange -- agent_defined/settings.json has no last_end field
    // (seeded in before())

    // Act
    await handler(SESSION_END_PAYLOAD, tmpDir);

    // Assert -- settings.json must be updated with a current timestamp
    const settingsPath = agentSettingsPath(tmpDir);
    assert.ok(
      fs.existsSync(settingsPath),
      'agent_defined/settings.json must exist after handler runs'
    );

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    // The handler must write some form of end/updated timestamp.
    // Accept either a top-level last_end or an updated_at field.
    const hasTimestamp =
      typeof settings.last_end === 'string' ||
      typeof settings.updated_at === 'string';
    assert.ok(
      hasTimestamp,
      'agent settings must contain a last_end or updated_at timestamp after SessionEnd'
    );

    // The timestamp must be recent (within 10 seconds of when the test started)
    const timestampField = settings.last_end ?? settings.updated_at;
    const timestampMs = new Date(timestampField).getTime();
    assert.ok(
      !isNaN(timestampMs),
      `timestamp field must be a valid ISO date string, got: "${timestampField}"`
    );
    assert.ok(
      timestampMs >= beforeTime - 5000,
      'timestamp in agent settings must be a recent time (within 5s before test start or after)'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4: handles missing continuation planner gracefully
// ---------------------------------------------------------------------------

describe('si-session-end handler -- no continuation planner', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir('no-continuation');
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 1,
        status: 'in_progress',
        current_step: 'research',
      },
      agentSettings: {
        iterations: 0,
        best_score: null,
        continuation: {
          planner_id: null,
          streak: 0,
          notebook_path: null,
        },
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should complete without error and write handoff saying "none" when no continuation planner exists', async () => {
    // Arrange -- continuation.planner_id is null (no active continuation planner)
    // (seeded in before())

    // Act -- must not throw
    let thrownError = null;
    try {
      await handler(SESSION_END_PAYLOAD, tmpDir);
    } catch (err) {
      thrownError = err;
    }

    assert.equal(
      thrownError,
      null,
      `handler must not throw when continuation planner is absent -- got: ${thrownError}`
    );

    // Assert -- handoff.md must still be written
    const hPath = handoffPath(tmpDir);
    assert.ok(
      fs.existsSync(hPath),
      '.jaewon/context/handoff.md must be created even when no continuation planner exists'
    );

    // handoff.md must convey that there is no continuation planner
    const content = fs.readFileSync(hPath, 'utf8');
    const hasNoneIndicator =
      content.toLowerCase().includes('none') ||
      content.toLowerCase().includes('no continuation') ||
      content.toLowerCase().includes('planner_id: null') ||
      content.includes('null');
    assert.ok(
      hasNoneIndicator,
      'handoff.md must indicate no continuation planner (e.g. "none") when planner_id is null'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: preserves expected handoff content structure
// ---------------------------------------------------------------------------

describe('si-session-end handler -- handoff content structure', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir('structure');
    seedProjectRoot(tmpDir, {
      iterationState: {
        iteration: 10,
        status: 'in_progress',
        current_step: 'tournament',
      },
      agentSettings: {
        iterations: 9,
        best_score: 0.91,
        continuation: {
          planner_id: 'agent-continuation-planner-042',
          streak: 5,
          notebook_path: 'docs/agent_defined/notebook.json',
        },
      },
    });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should write handoff.md with a structured format containing all required sections', async () => {
    // Arrange -- full realistic state: iteration=10, step=tournament,
    //            active continuation planner, best_score=0.91, streak=5
    // (seeded in before())

    // Act
    await handler(SESSION_END_PAYLOAD, tmpDir);

    // Assert -- verify the handoff has the expected structural content
    const hPath = handoffPath(tmpDir);
    assert.ok(
      fs.existsSync(hPath),
      '.jaewon/context/handoff.md must exist after handler runs'
    );

    const content = fs.readFileSync(hPath, 'utf8');

    // Must be non-trivially long (more than a one-liner placeholder)
    assert.ok(
      content.length >= 80,
      `handoff.md must be at least 80 characters; got ${content.length} chars`
    );

    // Must mention the iteration number
    assert.ok(
      content.includes('10'),
      'handoff.md must reference iteration 10'
    );

    // Must mention the step the loop was at
    assert.ok(
      content.toLowerCase().includes('tournament'),
      'handoff.md must reference the current step ("tournament")'
    );

    // Must mention the continuation planner identity
    assert.ok(
      content.includes('agent-continuation-planner-042'),
      'handoff.md must include the continuation planner id (agent-continuation-planner-042)'
    );

    // Must mention the streak
    assert.ok(
      content.includes('5'),
      'handoff.md must include the continuation streak (5)'
    );

    // Must mention the best score
    assert.ok(
      content.includes('0.91'),
      'handoff.md must include the best score (0.91)'
    );

    // Must suggest a next action (resume)
    const hasNextAction =
      content.toLowerCase().includes('resume') ||
      content.toLowerCase().includes('next action') ||
      content.toLowerCase().includes('next:');
    assert.ok(
      hasNextAction,
      'handoff.md must contain a next-action hint (e.g. "resume from step" or "next action")'
    );
  });
});
