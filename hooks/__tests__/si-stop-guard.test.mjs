/**
 * si-stop-guard.test.mjs
 * RED phase tests for Task 5.5: si-stop-guard.mjs (Stop hook)
 *
 * Purpose: Block premature stops during critical loop operations.
 * Handler signature: export default async function handler(payload, projectRoot)
 * Returns: { decision: "block", reason: "..." } | { decision: "allow" } | { decision: "allow", warning: "..." }
 *
 * Run: node --test hooks/__tests__/si-stop-guard.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The handler under test -- does not exist yet (RED phase).
 * Import will fail; each test catches that at import time.
 */
const HANDLER_PATH = path.resolve(__dirname, '..', 'si-stop-guard.mjs');

// ---------------------------------------------------------------------------
// Helper: build a minimal temp project root with the two state files the
// hook reads (iteration_state.json and agent_defined/settings.json).
// ---------------------------------------------------------------------------

function makeTempProjectRoot(iterationStateOverrides = {}, agentSettingsOverrides = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'si-stop-guard-test-'));

  const iterStateDir = path.join(tmpDir, 'docs', 'agent_defined');
  fs.mkdirSync(iterStateDir, { recursive: true });

  // Minimal iteration_state.json defaults
  const iterationState = {
    iteration: 1,
    status: 'in_progress',
    current_step: 'stop_check',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    research:   { status: 'pending', output_path: null, completed_at: null },
    planning:   { status: 'pending', plans: {}, approved_count: 0, completed_at: null },
    execution:  { status: 'pending', executors: {}, completed_at: null },
    tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
    recording:  { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
    user_ideas_consumed: [],
    ...iterationStateOverrides,
  };

  // Minimal agent_defined/settings.json defaults
  const agentSettings = {
    iterations: 0,
    status: 'running',
    best_score: null,
    current_milestone: null,
    current_phase: null,
    plateau_consecutive_count: 0,
    circuit_breaker_count: 0,
    si_setting_goal: true,
    si_setting_benchmark: true,
    si_setting_harness: true,
    continuation: { planner_id: null, streak: 0, notebook_path: null },
    retrospection_state: { last_round: null, reshaped: false, reshape_trigger_round: null },
    recent_winners: [],
    hybrid_stats: { total: 0, wins: 0, skips: 0 },
    ...agentSettingsOverrides,
  };

  fs.writeFileSync(
    path.join(iterStateDir, 'iteration_state.json'),
    JSON.stringify(iterationState, null, 2),
    'utf8'
  );

  fs.writeFileSync(
    path.join(iterStateDir, 'settings.json'),
    JSON.stringify(agentSettings, null, 2),
    'utf8'
  );

  return tmpDir;
}

// ---------------------------------------------------------------------------
// Import helper: dynamically import the handler, expecting it to exist.
// Because the module does not exist in the RED phase, this will throw an
// ERR_MODULE_NOT_FOUND error -- which is the correct RED failure.
// ---------------------------------------------------------------------------

async function loadHandler() {
  const mod = await import(HANDLER_PATH);
  // The handler must be the default export
  assert.ok(
    typeof mod.default === 'function',
    'si-stop-guard.mjs must export a default async function (the handler)'
  );
  return mod.default;
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

function removeTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('si-stop-guard handler', () => {

  // -------------------------------------------------------------------------
  // Test 1: blocks stop during execution step
  // -------------------------------------------------------------------------
  it('should block stop when current_step is execution', async () => {
    // Arrange
    const projectRoot = makeTempProjectRoot(
      { current_step: 'execution', status: 'in_progress' },
      { status: 'running' }
    );
    const payload = {};

    try {
      // Act
      const handler = await loadHandler();
      const result = await handler(payload, projectRoot);

      // Assert
      assert.equal(
        result.decision,
        'block',
        'handler must return decision="block" when current_step is "execution"'
      );
      assert.ok(
        typeof result.reason === 'string' && result.reason.length > 0,
        'handler must return a non-empty reason string when blocking'
      );
      assert.ok(
        result.reason.toLowerCase().includes('execution'),
        `reason must mention "execution" -- got: "${result.reason}"`
      );
    } finally {
      removeTempDir(projectRoot);
    }
  });

  // -------------------------------------------------------------------------
  // Test 2: blocks stop during tournament step
  // -------------------------------------------------------------------------
  it('should block stop when current_step is tournament', async () => {
    // Arrange
    const projectRoot = makeTempProjectRoot(
      { current_step: 'tournament', status: 'in_progress' },
      { status: 'running' }
    );
    const payload = {};

    try {
      // Act
      const handler = await loadHandler();
      const result = await handler(payload, projectRoot);

      // Assert
      assert.equal(
        result.decision,
        'block',
        'handler must return decision="block" when current_step is "tournament"'
      );
      assert.ok(
        typeof result.reason === 'string' && result.reason.length > 0,
        'handler must return a non-empty reason string when blocking'
      );
      assert.ok(
        result.reason.toLowerCase().includes('tournament'),
        `reason must mention "tournament" -- got: "${result.reason}"`
      );
    } finally {
      removeTempDir(projectRoot);
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: blocks stop during recording step
  // -------------------------------------------------------------------------
  it('should block stop when current_step is recording', async () => {
    // Arrange
    const projectRoot = makeTempProjectRoot(
      { current_step: 'recording', status: 'in_progress' },
      { status: 'running' }
    );
    const payload = {};

    try {
      // Act
      const handler = await loadHandler();
      const result = await handler(payload, projectRoot);

      // Assert
      assert.equal(
        result.decision,
        'block',
        'handler must return decision="block" when current_step is "recording"'
      );
      assert.ok(
        typeof result.reason === 'string' && result.reason.length > 0,
        'handler must return a non-empty reason string when blocking'
      );
      assert.ok(
        result.reason.toLowerCase().includes('recording'),
        `reason must mention "recording" -- got: "${result.reason}"`
      );
    } finally {
      removeTempDir(projectRoot);
    }
  });

  // -------------------------------------------------------------------------
  // Test 4: allows stop when agent settings status is stop_requested
  // Status check takes priority over current_step (even during execution).
  // -------------------------------------------------------------------------
  it('should allow stop when agent settings status is stop_requested', async () => {
    // Arrange — even though current_step=execution, stop_requested overrides
    const projectRoot = makeTempProjectRoot(
      { current_step: 'execution', status: 'in_progress' },
      { status: 'stop_requested' }
    );
    const payload = {};

    try {
      // Act
      const handler = await loadHandler();
      const result = await handler(payload, projectRoot);

      // Assert
      assert.equal(
        result.decision,
        'allow',
        'handler must return decision="allow" when agent settings status is "stop_requested"'
      );
    } finally {
      removeTempDir(projectRoot);
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: allows stop between iterations (current_step is stop_check)
  // -------------------------------------------------------------------------
  it('should allow stop freely when current_step is stop_check', async () => {
    // Arrange
    const projectRoot = makeTempProjectRoot(
      { current_step: 'stop_check', status: 'in_progress' },
      { status: 'running' }
    );
    const payload = {};

    try {
      // Act
      const handler = await loadHandler();
      const result = await handler(payload, projectRoot);

      // Assert
      assert.equal(
        result.decision,
        'allow',
        'handler must return decision="allow" when current_step is "stop_check" (between iterations)'
      );
    } finally {
      removeTempDir(projectRoot);
    }
  });

  // -------------------------------------------------------------------------
  // Test 6: warns but allows during research step
  // -------------------------------------------------------------------------
  it('should warn but allow stop when current_step is research', async () => {
    // Arrange
    const projectRoot = makeTempProjectRoot(
      { current_step: 'research', status: 'in_progress' },
      { status: 'running' }
    );
    const payload = {};

    try {
      // Act
      const handler = await loadHandler();
      const result = await handler(payload, projectRoot);

      // Assert
      assert.equal(
        result.decision,
        'allow',
        'handler must return decision="allow" during research step (warn but do not block)'
      );
      assert.ok(
        typeof result.warning === 'string' && result.warning.length > 0,
        'handler must include a non-empty warning string when allowing stop mid-research'
      );
    } finally {
      removeTempDir(projectRoot);
    }
  });

  // -------------------------------------------------------------------------
  // Test 7: warns but allows during planning step
  // -------------------------------------------------------------------------
  it('should warn but allow stop when current_step is planning', async () => {
    // Arrange
    const projectRoot = makeTempProjectRoot(
      { current_step: 'planning', status: 'in_progress' },
      { status: 'running' }
    );
    const payload = {};

    try {
      // Act
      const handler = await loadHandler();
      const result = await handler(payload, projectRoot);

      // Assert
      assert.equal(
        result.decision,
        'allow',
        'handler must return decision="allow" during planning step (warn but do not block)'
      );
      assert.ok(
        typeof result.warning === 'string' && result.warning.length > 0,
        'handler must include a non-empty warning string when allowing stop mid-planning'
      );
    } finally {
      removeTempDir(projectRoot);
    }
  });

});
