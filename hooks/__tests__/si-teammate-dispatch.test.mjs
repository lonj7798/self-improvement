/**
 * si-teammate-dispatch.test.mjs
 * RED phase tests for Task 5.3: hooks/si-teammate-dispatch.mjs (TeammateIdle hook)
 *
 * All 6 tests FAIL until the implementation file is created.
 * Expected failure reason: ERR_MODULE_NOT_FOUND (si-teammate-dispatch.mjs does not exist)
 *
 * Run: node --test hooks/__tests__/si-teammate-dispatch.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 *
 * Handler signature:
 *   export default async function handler(payload, projectRoot)
 *   payload: { teammate_id, hook_event_name, ... }
 *   projectRoot: absolute path to the self-improvement project root
 *
 * The handler reads iteration_state.json and teammate_registry.json to decide
 * what work (if any) to dispatch to the idle teammate. Tests use isolated temp
 * dirs with realistic state files — no shared mutable state between tests.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------------------------------------------------------------------------
// Import from the module that does NOT exist yet -- this is the RED phase.
// Every test fails at module-load time with ERR_MODULE_NOT_FOUND.
// ---------------------------------------------------------------------------
import handler from '../si-teammate-dispatch.mjs';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fresh isolated temp directory that mirrors the expected project
 * layout and returns its absolute path. Caller receives a fully self-contained
 * project root that cannot interfere with any other test.
 */
function makeTempProjectRoot(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `si-dispatch-${label}-`));
  fs.mkdirSync(path.join(dir, 'docs', 'agent_defined'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'user_defined'), { recursive: true });
  return dir;
}

/**
 * Recursively removes a temp dir created by this test suite.
 */
function cleanupTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Writes iteration_state.json into the given project root.
 */
function writeIterationState(projectRoot, state) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'iteration_state.json');
  fs.writeFileSync(fp, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Writes teammate_registry.json into the given project root.
 */
function writeRegistry(projectRoot, registry) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'teammate_registry.json');
  fs.writeFileSync(fp, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * Writes agent_defined/settings.json into the given project root.
 */
function writeAgentSettings(projectRoot, settings) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
  fs.writeFileSync(fp, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Minimal base iteration_state for an in-progress planning step.
 */
function basePlanningIterationState(overrides = {}) {
  return {
    iteration: 2,
    status: 'in_progress',
    current_step: 'planning',
    started_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-15T08:10:00.000Z',
    research: { status: 'completed', output_path: 'docs/agent_defined/research_briefs/round_2.json', completed_at: '2026-04-15T08:05:00.000Z' },
    planning: { status: 'in_progress', plans: {}, approved_count: 0, completed_at: null },
    execution: { status: 'pending', executors: {}, completed_at: null },
    tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
    recording: { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
    user_ideas_consumed: [],
    ...overrides,
  };
}

/**
 * Minimal registry entry for a continuation planner.
 */
function continuationEntry(id) {
  return {
    id,
    role: 'continuation',
    status: 'active',
    session_id: 'sess-cont-001',
    started_at: '2026-04-15T07:00:00.000Z',
  };
}

/**
 * Minimal registry entry for a challenger.
 */
function challengerEntry(id) {
  return {
    id,
    role: 'challenger',
    status: 'active',
    session_id: 'sess-chal-001',
    started_at: '2026-04-15T07:00:00.000Z',
  };
}

/**
 * Minimal registry with a given list of teammate entries.
 */
function makeRegistry(teammates) {
  return {
    teammates,
    updated_at: '2026-04-15T08:00:00.000Z',
  };
}

/**
 * Minimal agent settings with sane defaults.
 */
function baseAgentSettings(overrides = {}) {
  return {
    iterations: 1,
    best_score: 0.82,
    status: 'running',
    continuation: { planner_id: null, streak: 0, notebook_path: null },
    recent_winners: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: identifies continuation planner from registry
// ---------------------------------------------------------------------------

describe('handler -- identifies continuation planner from registry', () => {
  const CONT_ID = 'agent-continuation-planner-001';
  let tmpDir;

  before(() => {
    tmpDir = makeTempProjectRoot('cont-id');

    // Arrange: registry contains this teammate as role="continuation"
    writeRegistry(tmpDir, makeRegistry([continuationEntry(CONT_ID)]));

    // iteration_state is in planning step so role lookup is valid
    writeIterationState(tmpDir, basePlanningIterationState());

    writeAgentSettings(tmpDir, baseAgentSettings({
      continuation: { planner_id: CONT_ID, streak: 2, notebook_path: 'docs/agent_defined/notebook.json' },
    }));
  });

  after(() => {
    cleanupTempDir(tmpDir);
  });

  it('should return role continuation when teammate_id matches continuation entry in registry', async () => {
    // Arrange
    const payload = {
      teammate_id: CONT_ID,
      hook_event_name: 'TeammateIdle',
    };

    // Act
    const result = await handler(payload, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.role,
      'continuation',
      'role must be "continuation" when teammate_id matches the continuation entry in the registry'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2: identifies challenger from registry
// ---------------------------------------------------------------------------

describe('handler -- identifies challenger from registry', () => {
  const CHAL_ID = 'agent-challenger-planner-002';
  let tmpDir;

  before(() => {
    tmpDir = makeTempProjectRoot('chal-id');

    // Arrange: registry contains this teammate as role="challenger"
    writeRegistry(tmpDir, makeRegistry([challengerEntry(CHAL_ID)]));

    writeIterationState(tmpDir, basePlanningIterationState());
    writeAgentSettings(tmpDir, baseAgentSettings());
  });

  after(() => {
    cleanupTempDir(tmpDir);
  });

  it('should return role challenger when teammate_id matches a challenger entry in registry', async () => {
    // Arrange
    const payload = {
      teammate_id: CHAL_ID,
      hook_event_name: 'TeammateIdle',
    };

    // Act
    const result = await handler(payload, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.role,
      'challenger',
      'role must be "challenger" when teammate_id matches a challenger entry in the registry'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: returns no_action when teammate not in registry
// ---------------------------------------------------------------------------

describe('handler -- returns no_action when teammate not in registry', () => {
  const UNKNOWN_ID = 'agent-unknown-zzz-999';
  let tmpDir;

  before(() => {
    tmpDir = makeTempProjectRoot('unknown-id');

    // Arrange: registry does NOT contain UNKNOWN_ID
    writeRegistry(tmpDir, makeRegistry([
      continuationEntry('agent-continuation-planner-001'),
      challengerEntry('agent-challenger-planner-002'),
    ]));

    writeIterationState(tmpDir, basePlanningIterationState());
    writeAgentSettings(tmpDir, baseAgentSettings());
  });

  after(() => {
    cleanupTempDir(tmpDir);
  });

  it('should return no_action when teammate_id is not found in registry', async () => {
    // Arrange
    const payload = {
      teammate_id: UNKNOWN_ID,
      hook_event_name: 'TeammateIdle',
    };

    // Act
    const result = await handler(payload, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.action,
      'no_action',
      'action must be "no_action" when teammate_id does not appear in the registry'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4: returns dispatch when planning step is active and teammate unassigned
// ---------------------------------------------------------------------------

describe('handler -- returns dispatch when planning step active and teammate unassigned', () => {
  const CHAL_ID = 'agent-challenger-planner-003';
  let tmpDir;

  before(() => {
    tmpDir = makeTempProjectRoot('dispatch');

    // Arrange: current_step="planning", challenger has not yet been assigned a plan
    writeRegistry(tmpDir, makeRegistry([challengerEntry(CHAL_ID)]));

    writeIterationState(tmpDir, basePlanningIterationState({
      // planning.plans is empty -- this challenger has not been assigned
      planning: { status: 'in_progress', plans: {}, approved_count: 0, completed_at: null },
    }));

    writeAgentSettings(tmpDir, baseAgentSettings());

    // Write a minimal research brief so the handler can include it in the dispatch
    const briefDir = path.join(tmpDir, 'docs', 'agent_defined', 'research_briefs');
    fs.mkdirSync(briefDir, { recursive: true });
    fs.writeFileSync(
      path.join(briefDir, 'round_2.json'),
      JSON.stringify({
        iteration: 2,
        ideas: [{ title: 'Improve cache locality', confidence: 'high' }],
      }, null, 2),
      'utf8'
    );
  });

  after(() => {
    cleanupTempDir(tmpDir);
  });

  it('should return dispatch action with brief when planning step is active and teammate is unassigned', async () => {
    // Arrange
    const payload = {
      teammate_id: CHAL_ID,
      hook_event_name: 'TeammateIdle',
    };

    // Act
    const result = await handler(payload, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.action,
      'dispatch',
      'action must be "dispatch" when current_step is "planning" and teammate has not been assigned'
    );
    assert.ok(
      result.brief !== undefined && result.brief !== null,
      'dispatch result must include a brief field for the planner to work from'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: returns no_action when no work available (non-planning step)
// ---------------------------------------------------------------------------

describe('handler -- returns no_action when current step is not planning or winner_handoff', () => {
  const CONT_ID = 'agent-continuation-planner-004';
  let tmpDir;

  before(() => {
    tmpDir = makeTempProjectRoot('no-work');

    // Arrange: current_step="execution" -- no planning work for this teammate
    writeRegistry(tmpDir, makeRegistry([continuationEntry(CONT_ID)]));

    writeIterationState(tmpDir, {
      iteration: 2,
      status: 'in_progress',
      current_step: 'execution',
      started_at: '2026-04-15T08:00:00.000Z',
      updated_at: '2026-04-15T08:20:00.000Z',
      research: { status: 'completed', output_path: 'docs/agent_defined/research_briefs/round_2.json', completed_at: '2026-04-15T08:05:00.000Z' },
      planning: { status: 'completed', plans: { planner_a: { status: 'completed', critic_approved: true } }, approved_count: 1, completed_at: '2026-04-15T08:15:00.000Z' },
      execution: { status: 'in_progress', executors: {}, completed_at: null },
      tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
      recording: { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
      user_ideas_consumed: [],
    });

    writeAgentSettings(tmpDir, baseAgentSettings({
      continuation: { planner_id: CONT_ID, streak: 1, notebook_path: 'docs/agent_defined/notebook.json' },
    }));
  });

  after(() => {
    cleanupTempDir(tmpDir);
  });

  it('should return no_action when current_step is execution and no planning work is available', async () => {
    // Arrange
    const payload = {
      teammate_id: CONT_ID,
      hook_event_name: 'TeammateIdle',
    };

    // Act
    const result = await handler(payload, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.action,
      'no_action',
      'action must be "no_action" when current_step is "execution" (not a planning or handoff step)'
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6: returns handoff_feedback when step is winner_handoff
// ---------------------------------------------------------------------------

describe('handler -- returns handoff_feedback when step is winner_handoff', () => {
  const CONT_ID = 'agent-continuation-planner-005';
  let tmpDir;

  before(() => {
    tmpDir = makeTempProjectRoot('handoff');

    // Arrange: current_step="winner_handoff" -- continuation planner should receive
    // win feedback with score delta so it can update its notebook
    writeRegistry(tmpDir, makeRegistry([continuationEntry(CONT_ID)]));

    writeIterationState(tmpDir, {
      iteration: 3,
      status: 'in_progress',
      current_step: 'winner_handoff',
      started_at: '2026-04-15T09:00:00.000Z',
      updated_at: '2026-04-15T09:45:00.000Z',
      research: { status: 'completed', output_path: 'docs/agent_defined/research_briefs/round_3.json', completed_at: '2026-04-15T09:10:00.000Z' },
      planning: { status: 'completed', plans: {}, approved_count: 1, completed_at: '2026-04-15T09:20:00.000Z' },
      execution: { status: 'completed', executors: {}, completed_at: '2026-04-15T09:35:00.000Z' },
      tournament: {
        status: 'completed',
        winner: 'executor_1',
        winner_score: 0.91,
        completed_at: '2026-04-15T09:40:00.000Z',
      },
      recording: { status: 'in_progress', history_path: null, visualization_updated: false, cleanup_done: false },
      user_ideas_consumed: [],
    });

    writeAgentSettings(tmpDir, baseAgentSettings({
      best_score: 0.88,
      continuation: { planner_id: CONT_ID, streak: 3, notebook_path: 'docs/agent_defined/notebook.json' },
    }));
  });

  after(() => {
    cleanupTempDir(tmpDir);
  });

  it('should return handoff_feedback action when current_step is winner_handoff', async () => {
    // Arrange
    const payload = {
      teammate_id: CONT_ID,
      hook_event_name: 'TeammateIdle',
    };

    // Act
    const result = await handler(payload, tmpDir);

    // Assert
    assert.ok(result !== null && result !== undefined, 'handler must return a value');
    assert.equal(
      result.action,
      'handoff_feedback',
      'action must be "handoff_feedback" when current_step is "winner_handoff"'
    );
  });
});
