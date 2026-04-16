/**
 * agent-settings-ext.test.mjs
 * RED phase tests for Task 2.2: Extend agent_defined/settings.json
 *
 * These tests define the contract for the v0.0.1-B agent settings extension.
 * Every test must FAIL until:
 *   1. readAgentSettings is updated to merge v0.0.1-B defaults
 *   2. validateSchema('agent_settings') is extended to know about the new fields
 *      (specifically, continuation must be typed as 'object' in SCHEMAS)
 *   3. docs/agent_defined/settings.json is updated with the new fields
 *
 * Run: node --test hooks/lib/__tests__/agent-settings-ext.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { readAgentSettings, validateSchema } from '../state-io.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-settings-ext-test-'));
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * The 9-field v0.0.1-A format — what is currently on disk in any existing
 * installation that has not yet been upgraded to v0.0.1-B.
 */
const LEGACY_AGENT_SETTINGS = {
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

// ---------------------------------------------------------------------------
// Test 1: readAgentSettings returns new v0.0.1-B fields with defaults
//
// Contract: when the on-disk file contains only the 9 legacy fields,
// readAgentSettings must deep-merge v0.0.1-B defaults so callers always
// receive all 13 fields without having to guard against undefined.
//
// WHY THIS FAILS NOW:
//   readAgentSettings returns `readJSON(fp) ?? {}` with no default merging.
//   Reading a legacy file returns only the 9 stored fields. Every assertion
//   on continuation, retrospection_state, recent_winners, and hybrid_stats
//   throws AssertionError because those keys are absent.
// ---------------------------------------------------------------------------

describe('readAgentSettings', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Write only the legacy 9-field file — simulates an existing installation
    const settingsDir = path.join(tmpDir, 'docs', 'agent_defined');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(LEGACY_AGENT_SETTINGS),
      'utf8'
    );
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return new v0.0.1-B fields with defaults when file has only legacy fields', () => {
    // Arrange — legacy file written in before(); no new fields on disk

    // Act
    const result = readAgentSettings(tmpDir);

    // Assert — all 9 legacy fields still present
    assert.ok(result !== null, 'result must not be null');
    assert.equal(typeof result.iterations, 'number', 'legacy field "iterations" must be present');
    assert.ok('status' in result, 'legacy field "status" must be present');

    // Assert — new "continuation" section with correct defaults
    assert.ok('continuation' in result, 'readAgentSettings must return a "continuation" field');
    assert.equal(typeof result.continuation, 'object', '"continuation" must be an object');
    assert.ok(!Array.isArray(result.continuation), '"continuation" must not be an array');
    assert.ok('planner_id' in result.continuation, '"continuation.planner_id" must be present');
    assert.equal(result.continuation.planner_id, null, '"continuation.planner_id" default must be null');
    assert.ok('streak' in result.continuation, '"continuation.streak" must be present');
    assert.equal(result.continuation.streak, 0, '"continuation.streak" default must be 0');
    assert.ok('notebook_path' in result.continuation, '"continuation.notebook_path" must be present');
    assert.equal(result.continuation.notebook_path, null, '"continuation.notebook_path" default must be null');

    // Assert — new "retrospection_state" section with correct defaults
    assert.ok('retrospection_state' in result, 'readAgentSettings must return a "retrospection_state" field');
    assert.equal(typeof result.retrospection_state, 'object', '"retrospection_state" must be an object');
    assert.ok(!Array.isArray(result.retrospection_state), '"retrospection_state" must not be an array');
    assert.ok('last_round' in result.retrospection_state, '"retrospection_state.last_round" must be present');
    assert.equal(result.retrospection_state.last_round, null, '"retrospection_state.last_round" default must be null');
    assert.ok('reshaped' in result.retrospection_state, '"retrospection_state.reshaped" must be present');
    assert.equal(result.retrospection_state.reshaped, false, '"retrospection_state.reshaped" default must be false');
    assert.ok('reshape_trigger_round' in result.retrospection_state, '"retrospection_state.reshape_trigger_round" must be present');
    assert.equal(result.retrospection_state.reshape_trigger_round, null, '"retrospection_state.reshape_trigger_round" default must be null');

    // Assert — new "recent_winners" field with correct default
    assert.ok('recent_winners' in result, 'readAgentSettings must return a "recent_winners" field');
    assert.ok(Array.isArray(result.recent_winners), '"recent_winners" default must be an empty array');
    assert.equal(result.recent_winners.length, 0, '"recent_winners" default array must be empty');

    // Assert — new "hybrid_stats" section with correct defaults
    assert.ok('hybrid_stats' in result, 'readAgentSettings must return a "hybrid_stats" field');
    assert.equal(typeof result.hybrid_stats, 'object', '"hybrid_stats" must be an object');
    assert.ok(!Array.isArray(result.hybrid_stats), '"hybrid_stats" must not be an array');
    assert.ok('total' in result.hybrid_stats, '"hybrid_stats.total" must be present');
    assert.equal(result.hybrid_stats.total, 0, '"hybrid_stats.total" default must be 0');
    assert.ok('wins' in result.hybrid_stats, '"hybrid_stats.wins" must be present');
    assert.equal(result.hybrid_stats.wins, 0, '"hybrid_stats.wins" default must be 0');
    assert.ok('skips' in result.hybrid_stats, '"hybrid_stats.skips" must be present');
    assert.equal(result.hybrid_stats.skips, 0, '"hybrid_stats.skips" default must be 0');
  });
});

// ---------------------------------------------------------------------------
// Test 2: validateSchema passes agent settings with new fields
//
// Contract: validateSchema('agent_settings', data) must recognise and type-
// check the new v0.0.1-B fields. A data object where `continuation` is a
// string (not an object) must produce valid=false with an error that names
// the offending field.
//
// WHY THIS FAILS NOW:
//   SCHEMAS.agent_settings in state-io.mjs does not list continuation,
//   retrospection_state, recent_winners, or hybrid_stats. Extra fields are
//   silently ignored, so passing continuation="planner_a" currently returns
//   valid=true. The assertion `result.valid === false` therefore fails with
//   AssertionError (actual: true, expected: false).
// ---------------------------------------------------------------------------

describe('validateSchema — agent_settings with new fields', () => {
  it('should return valid=false when continuation field has wrong type', () => {
    // Arrange — all 9 legacy fields valid, but continuation is a string not an object
    const invalidContinuation = {
      ...LEGACY_AGENT_SETTINGS,
      continuation: 'planner_a',          // must be an object
      retrospection_state: { last_round: null, reshaped: false, reshape_trigger_round: null },
      recent_winners: [],
      hybrid_stats: { total: 0, wins: 0, skips: 0 },
    };

    // Act
    const result = validateSchema('agent_settings', invalidContinuation);

    // Assert — schema must detect the type violation on the new field
    assert.equal(
      result.valid,
      false,
      'validateSchema must return valid=false when "continuation" is not an object'
    );
    assert.ok(Array.isArray(result.errors), 'errors must be an array');
    assert.ok(result.errors.length > 0, 'errors array must be non-empty');
    const mentionsContinuation = result.errors.some(
      (e) => e.toLowerCase().includes('continuation')
    );
    assert.ok(
      mentionsContinuation,
      `At least one error must mention "continuation"; got: ${JSON.stringify(result.errors)}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: validateSchema passes agent settings without new fields (backward compat)
//
// Contract: after the schema is extended in GREEN, the legacy 9-field format
// must still produce valid=true. New v0.0.1-B fields are optional — their
// absence must not be an error.
//
// WHY THIS FAILS NOW:
//   This test exercises readAgentSettings first (to obtain merged defaults)
//   then validates the result. Because readAgentSettings does not yet merge
//   defaults (see Test 1), calling it with a legacy file returns only 9
//   fields. The subsequent validateSchema call is against the 9-field object,
//   which the current schema accepts — so valid=true. HOWEVER, the test also
//   asserts that the returned settings object contains the continuation field
//   (proving readAgentSettings merges defaults before we validate). That
//   assertion fails for the same reason as Test 1 — the continuation field is
//   absent — causing this test to fail in RED for the correct reason.
// ---------------------------------------------------------------------------

describe('validateSchema — agent_settings backward compatibility', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Write only the legacy 9-field file — no new fields on disk
    const settingsDir = path.join(tmpDir, 'docs', 'agent_defined');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(LEGACY_AGENT_SETTINGS),
      'utf8'
    );
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return valid=true for settings read from a legacy file after default merging', () => {
    // Arrange — read a legacy-format settings file; readAgentSettings must
    // merge in v0.0.1-B defaults so the result is the full 13-field object

    // Act
    const merged = readAgentSettings(tmpDir);

    // Assert — the merged result must contain the new fields (readAgentSettings
    // must have supplied the defaults even though the file lacked them)
    assert.ok(
      'continuation' in merged,
      'readAgentSettings must supply default "continuation" even for a legacy file'
    );
    assert.ok(
      'retrospection_state' in merged,
      'readAgentSettings must supply default "retrospection_state" even for a legacy file'
    );
    assert.ok(
      'recent_winners' in merged,
      'readAgentSettings must supply default "recent_winners" even for a legacy file'
    );
    assert.ok(
      'hybrid_stats' in merged,
      'readAgentSettings must supply default "hybrid_stats" even for a legacy file'
    );

    // Assert — the merged 13-field object must pass schema validation (backward
    // compat: new fields optional, so a file that was missing them and got
    // defaults merged in is still considered a valid agent_settings document)
    const result = validateSchema('agent_settings', merged);
    assert.equal(
      result.valid,
      true,
      'validateSchema must return valid=true for a legacy file after default merging'
    );
    assert.deepEqual(
      result.errors,
      [],
      'errors must be empty for a merged legacy agent_settings object'
    );
  });
});
