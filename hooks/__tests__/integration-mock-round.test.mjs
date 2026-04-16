/**
 * integration-mock-round.test.mjs — Integration test for the full hook pipeline.
 * Simulates a complete round's state transitions from SessionStart through SessionEnd.
 *
 * @calling-spec
 * - This file is a test module. It has no exported functions.
 *   Input:  none (run via node --test)
 *   Output: test results to stdout/stderr
 *   Side effects: creates and removes a temp directory per test suite
 *   Depends on: ../si-loop-resume.mjs, ../si-agent-tracker.mjs,
 *               ../si-stop-guard.mjs, ../si-session-end.mjs
 *
 * Run: node --test hooks/__tests__/integration-mock-round.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import loopResume from '../si-loop-resume.mjs';
import agentTracker from '../si-agent-tracker.mjs';
import stopGuard from '../si-stop-guard.mjs';
import sessionEnd from '../si-session-end.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'si-integration-'));
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf8');
}

function readFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Seed all required state files in a temp project root. */
function seedProjectRoot(projectRoot) {
  // iteration_state.json — fresh state (no previous iteration)
  writeFile(
    path.join(projectRoot, 'docs', 'agent_defined', 'iteration_state.json'),
    {
      iteration: 1,
      status: 'in_progress',
      current_step: 'research',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      research: { status: 'in_progress', output_path: null, completed_at: null },
      planning: { status: 'pending', plans: {}, approved_count: 0, completed_at: null },
      execution: { status: 'pending', executors: {}, completed_at: null },
      tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
      recording: { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
      user_ideas_consumed: [],
    }
  );

  // agent_defined/settings.json
  writeFile(
    path.join(projectRoot, 'docs', 'agent_defined', 'settings.json'),
    {
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
    }
  );

  // user_defined/settings.json
  writeFile(
    path.join(projectRoot, 'docs', 'user_defined', 'settings.json'),
    {
      si_claude_setting: true,
      number_of_agents: 1,
      number_of_max_critics: 1,
      current_repo_url: 'https://github.com/example/repo',
      fork_url: 'https://github.com/jaewon/repo',
      upstream_url: 'https://github.com/example/repo',
      target_branch: 'main',
      benchmark_command: 'python3 scripts/benchmark.py',
      benchmark_format: 'json',
      benchmark_direction: 'higher_is_better',
      max_iterations: 10,
      plateau_threshold: 0.01,
      plateau_window: 3,
      target_value: null,
      primary_metric: 'primary',
      sealed_files: [],
      regression_threshold: 0.05,
      circuit_breaker_threshold: 3,
      hybrid_planner: { enabled: false, skip_when_all_diverse: true, redundancy_threshold_pct: 80 },
      de_risk: { enabled: false, timeout_seconds: 60, reduced_dataset_flag: '--subset 32' },
      simplicity: { max_lines_added: 200, threshold_pct: 5, tiebreak_by_lines: true },
      retrospection: { enabled: false, interval: 3, plateau_reshape_rounds: 1, near_miss_threshold_pct: 2, failure_rate_threshold_pct: 50, family_concentration_window: 3 },
    }
  );

  // teammate_registry.json — empty registry
  writeFile(
    path.join(projectRoot, 'docs', 'agent_defined', 'teammate_registry.json'),
    { teammates: [], updated_at: new Date().toISOString() }
  );

  // notebook.json
  writeFile(
    path.join(projectRoot, 'docs', 'agent_defined', 'notebook.json'),
    {
      planner_id: null,
      rounds_active: [],
      streak: 0,
      observations: [],
      dead_ends: [],
      current_theory: null,
    }
  );
}

// ---------------------------------------------------------------------------
// Integration test: full happy-path round
// ---------------------------------------------------------------------------

describe('integration — mock round happy path', () => {
  let tmpDir;

  const SESSION_PAYLOAD = { session_id: 'sess-integration-001', hook_event_name: 'SessionStart' };
  const SESSION_END_PAYLOAD = { session_id: 'sess-integration-001', hook_event_name: 'SessionEnd' };

  before(() => {
    tmpDir = makeTmpDir();
    seedProjectRoot(tmpDir);
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('step 1: si-loop-resume returns resume or fresh_start on SessionStart', async () => {
    const result = await loopResume(SESSION_PAYLOAD, tmpDir);

    assert.ok(result !== null && result !== undefined, 'loopResume must return a result');
    assert.ok(
      result.action === 'resume' || result.action === 'fresh_start',
      `action must be "resume" or "fresh_start"; got "${result.action}"`
    );
  });

  it('step 2: si-agent-tracker advances state when researcher-repo completes', async () => {
    // Arrange: write the research brief that the researcher would have produced
    const briefPath = path.join(tmpDir, 'docs', 'agent_defined', 'research_briefs', 'round_1.json');
    writeFile(briefPath, { ideas: [{ title: 'Reduce allocations in hot path' }] });

    const payload = {
      agent_id: 'researcher-repo',
      agent_type: 'researcher-repo',
      exit_status: 0,
      iteration: 1,
    };

    await agentTracker(payload, tmpDir);

    const state = readFile(path.join(tmpDir, 'docs', 'agent_defined', 'iteration_state.json'));
    assert.equal(state.research.status, 'completed', 'research.status must be "completed" after researcher completes');
    assert.equal(state.current_step, 'planning', 'current_step must advance to "planning" after researcher completes');
  });

  it('step 3: si-agent-tracker publishes findings when executor-1 completes', async () => {
    // Arrange: update state to execution step
    writeFile(
      path.join(tmpDir, 'docs', 'agent_defined', 'iteration_state.json'),
      {
        iteration: 1,
        status: 'in_progress',
        current_step: 'execution',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        research: { status: 'completed', output_path: null, completed_at: new Date().toISOString() },
        planning: { status: 'completed', plans: {}, approved_count: 0, completed_at: new Date().toISOString() },
        execution: {
          status: 'in_progress',
          executors: {
            executor_1: { status: 'pending', plan_id: 'planner_a', benchmark_score: null, output_path: null },
          },
          completed_at: null,
        },
        tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
        recording: { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
        user_ideas_consumed: [],
      }
    );

    // Arrange: write the result.json the executor would have produced
    const worktreeDir = path.join(tmpDir, 'want_to_improve', 'worktrees', 'round_1_executor_1');
    writeFile(path.join(worktreeDir, 'result.json'), {
      status: 'success',
      benchmark_score: 0.87,
      sub_scores: null,
    });

    const payload = {
      agent_id: 'executor_1',
      agent_type: 'executor-1',
      exit_status: 0,
      iteration: 1,
      executor_id: 'executor_1',
      worktree_dir: worktreeDir,
    };

    await agentTracker(payload, tmpDir);

    // Verify findings were published
    const findingsDir = path.join(tmpDir, 'docs', 'agent_defined', 'findings');
    const findingsFiles = fs.existsSync(findingsDir) ? fs.readdirSync(findingsDir) : [];
    assert.ok(findingsFiles.length > 0, 'findings file must be published after executor completes');

    // Verify state advanced
    const state = readFile(path.join(tmpDir, 'docs', 'agent_defined', 'iteration_state.json'));
    assert.ok(
      state.execution.executors.executor_1.status !== 'pending',
      'executor_1 status must be updated from "pending"'
    );
    assert.equal(state.current_step, 'tournament', 'current_step must advance to "tournament" when all executors done');
  });

  it('step 4: si-stop-guard blocks stop during execution step', async () => {
    // Arrange: set state to execution step (a CRITICAL_STEPS step)
    writeFile(
      path.join(tmpDir, 'docs', 'agent_defined', 'iteration_state.json'),
      {
        iteration: 1,
        status: 'in_progress',
        current_step: 'execution',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        research: { status: 'completed', output_path: null, completed_at: null },
        planning: { status: 'completed', plans: {}, approved_count: 0, completed_at: null },
        execution: { status: 'in_progress', executors: {}, completed_at: null },
        tournament: { status: 'pending', winner: null, winner_score: null, completed_at: null },
        recording: { status: 'pending', history_path: null, visualization_updated: false, cleanup_done: false },
        user_ideas_consumed: [],
      }
    );

    const result = await stopGuard({}, tmpDir);

    assert.equal(result.decision, 'block', 'stop must be blocked during execution step');
    assert.ok(typeof result.reason === 'string' && result.reason.length > 0, 'block result must include a reason');
  });

  it('step 5: si-session-end writes handoff.md on SessionEnd', async () => {
    await sessionEnd(SESSION_END_PAYLOAD, tmpDir);

    const handoffPath = path.join(tmpDir, '.jaewon', 'context', 'handoff.md');
    assert.ok(fs.existsSync(handoffPath), '.jaewon/context/handoff.md must be written by si-session-end');

    const content = fs.readFileSync(handoffPath, 'utf8');
    assert.ok(content.length > 0, 'handoff.md must be non-empty');
    assert.ok(
      content.toLowerCase().includes('iteration') || content.includes('1'),
      'handoff.md must reference the current iteration'
    );
  });
});
