/**
 * user-settings-ext.test.mjs
 * RED phase tests for Task 2.1: Extend user_defined/settings.json (v0.0.1-B).
 *
 * These 3 describe groups (9 subtests total) MUST FAIL until both:
 *   (a) docs/user_defined/settings.json is extended with the 4 new sections, AND
 *   (b) validateSchema('user_settings', ...) is updated to require the new fields,
 *   (c) readUserSettings merges new-field defaults so old files always return a
 *       complete v0.0.1-B structure.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/user-settings-ext.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { readUserSettings, validateSchema } from '../state-io.mjs';

// ---------------------------------------------------------------------------
// Constants: exact default values from v0.0.1-B design (task brief + plan doc)
// ---------------------------------------------------------------------------

const NEW_FIELD_DEFAULTS = {
  hybrid_planner: {
    enabled: false,
    skip_when_all_diverse: true,
    redundancy_threshold_pct: 80,
  },
  de_risk: {
    enabled: true,
    timeout_seconds: 60,
    reduced_dataset_flag: '--subset 32',
  },
  simplicity: {
    max_lines_added: 200,
    threshold_pct: 5,
    tiebreak_by_lines: true,
  },
  retrospection: {
    enabled: true,
    interval: 3,
    plateau_reshape_rounds: 1,
    near_miss_threshold_pct: 2,
    failure_rate_threshold_pct: 50,
    family_concentration_window: 3,
  },
};

// The 18 existing v0.0.1-A fields — preserved verbatim from current settings.json.
const V001A_SETTINGS = {
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

// The complete v0.0.1-B settings object (old fields + new fields).
const V001B_SETTINGS = {
  ...V001A_SETTINGS,
  ...NEW_FIELD_DEFAULTS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an isolated temp directory populated with a copy of the current
 * v0.0.1-A settings.json (no new fields).  Mirrors the directory layout that
 * readUserSettings(projectRoot) expects:
 *   <projectRoot>/docs/user_defined/settings.json
 */
function makeTmpProjectWithCurrentSettings() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'si-user-settings-ext-'));
  const userDefinedDir = path.join(tmpRoot, 'docs', 'user_defined');
  fs.mkdirSync(userDefinedDir, { recursive: true });
  fs.writeFileSync(
    path.join(userDefinedDir, 'settings.json'),
    JSON.stringify(V001A_SETTINGS, null, 2),
    'utf8'
  );
  return tmpRoot;
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Test group 1: readUserSettings returns new v0.0.1-B fields with defaults
// ---------------------------------------------------------------------------
//
// WHY THESE SUBTESTS FAIL (RED):
//   readUserSettings currently reads the file verbatim and returns it as-is.
//   The file (v0.0.1-A) does not contain hybrid_planner, de_risk, simplicity,
//   or retrospection.  Until readUserSettings is updated to merge in defaults
//   for missing fields, all four "key present" assertions below throw
//   AssertionError because the returned object lacks those keys.
// ---------------------------------------------------------------------------

describe('readUserSettings returns new v0.0.1-B fields with defaults', () => {
  let tmpRoot;
  let result;

  before(() => {
    // Arrange — project root pointing at a copy of the current (v0.0.1-A) file.
    tmpRoot = makeTmpProjectWithCurrentSettings();

    // Act — called once; individual subtests only assert on the result.
    result = readUserSettings(tmpRoot);
  });

  after(() => {
    rmrf(tmpRoot);
  });

  it('should return hybrid_planner section with correct defaults when field is absent from file', () => {
    // Assert
    assert.ok(result !== null && typeof result === 'object', 'readUserSettings must return an object');
    assert.ok('hybrid_planner' in result, 'result must contain hybrid_planner key');
    assert.deepEqual(
      result.hybrid_planner,
      NEW_FIELD_DEFAULTS.hybrid_planner,
      'hybrid_planner defaults must match v0.0.1-B spec exactly'
    );
  });

  it('should return de_risk section with correct defaults when field is absent from file', () => {
    // Assert
    assert.ok('de_risk' in result, 'result must contain de_risk key');
    assert.deepEqual(
      result.de_risk,
      NEW_FIELD_DEFAULTS.de_risk,
      'de_risk defaults must match v0.0.1-B spec exactly'
    );
  });

  it('should return simplicity section with correct defaults when field is absent from file', () => {
    // Assert
    assert.ok('simplicity' in result, 'result must contain simplicity key');
    assert.deepEqual(
      result.simplicity,
      NEW_FIELD_DEFAULTS.simplicity,
      'simplicity defaults must match v0.0.1-B spec exactly'
    );
  });

  it('should return retrospection section with correct defaults when field is absent from file', () => {
    // Assert
    assert.ok('retrospection' in result, 'result must contain retrospection key');
    assert.deepEqual(
      result.retrospection,
      NEW_FIELD_DEFAULTS.retrospection,
      'retrospection defaults must match v0.0.1-B spec exactly'
    );
  });
});

// ---------------------------------------------------------------------------
// Test group 2: validateSchema passes settings with new fields
// ---------------------------------------------------------------------------
//
// WHY THESE SUBTESTS FAIL (RED):
//   The current SCHEMAS.user_settings in state-io.mjs has no entries for
//   hybrid_planner, de_risk, simplicity, or retrospection.  Therefore
//   validateSchema cannot detect when a required new field is absent —
//   it returns valid=true for any object that satisfies the 18 old fields.
//
//   Subtest 1 (valid=false when hybrid_planner absent):
//     current schema → valid=true (new field not checked) → assertion fails.
//   Subtest 2 (valid=false when retrospection absent):
//     current schema → valid=true (new field not checked) → assertion fails.
//   Subtest 3 (valid=true when all v0.0.1-B fields present):
//     This subtest CURRENTLY PASSES.  It is included as a positive guard: once
//     the schema is made stricter in GREEN, it must still accept a complete
//     v0.0.1-B object.  The group's RED state is established by subtests 1 & 2.
// ---------------------------------------------------------------------------

describe('validateSchema passes settings with new fields', () => {
  it('should return valid=false when hybrid_planner is absent from otherwise complete settings', () => {
    // Arrange — full v0.0.1-B object with hybrid_planner removed.
    const missingHybridPlanner = { ...V001B_SETTINGS };
    delete missingHybridPlanner.hybrid_planner;

    // Act
    const result = validateSchema('user_settings', missingHybridPlanner);

    // Assert
    // FAILS RED: current schema ignores hybrid_planner → returns valid=true.
    assert.equal(
      result.valid,
      false,
      'validateSchema must return valid=false when hybrid_planner is missing'
    );
    assert.ok(
      result.errors.some(e => e.toLowerCase().includes('hybrid_planner')),
      `errors array must mention "hybrid_planner"; got: ${JSON.stringify(result.errors)}`
    );
  });

  it('should return valid=false when retrospection is absent from otherwise complete settings', () => {
    // Arrange — full v0.0.1-B object with retrospection removed.
    const missingRetrospection = { ...V001B_SETTINGS };
    delete missingRetrospection.retrospection;

    // Act
    const result = validateSchema('user_settings', missingRetrospection);

    // Assert
    // FAILS RED: current schema ignores retrospection → returns valid=true.
    assert.equal(
      result.valid,
      false,
      'validateSchema must return valid=false when retrospection is missing'
    );
    assert.ok(
      result.errors.some(e => e.toLowerCase().includes('retrospection')),
      `errors array must mention "retrospection"; got: ${JSON.stringify(result.errors)}`
    );
  });

  it('should return valid=true when all v0.0.1-B fields are present', () => {
    // Arrange — complete v0.0.1-B object; no fields removed.
    const completeV001B = { ...V001B_SETTINGS };

    // Act
    const result = validateSchema('user_settings', completeV001B);

    // Assert — a complete object must always pass the updated schema.
    assert.equal(result.valid, true, `expected valid=true; errors: ${JSON.stringify(result.errors)}`);
    assert.deepEqual(result.errors, []);
  });
});

// ---------------------------------------------------------------------------
// Test group 3: validateSchema passes settings without new fields (backward compat)
// ---------------------------------------------------------------------------
//
// WHY THESE SUBTESTS FAIL (RED):
//   The backward-compat contract is: a v0.0.1-A file on disk (no new fields)
//   read via readUserSettings must produce a result that (a) contains all new
//   fields with correct defaults and (b) passes the updated validateSchema.
//
//   Both subtests anchor on readUserSettings merging defaults:
//
//   Subtest 1: asserts hybrid_planner (and all new fields) are present in the
//     returned object even when the on-disk file lacks them.  Currently fails
//     because readUserSettings returns the raw file contents — no merge.
//
//   Subtest 2: calls validateSchema on the readUserSettings result and asserts
//     valid=true.  Currently this would pass only because the schema doesn't
//     check new fields.  Once GREEN makes the schema stricter (requiring new
//     fields), this subtest will fail UNLESS readUserSettings also merges
//     defaults — the two changes must land together.  Writing it now makes the
//     dependency explicit and ensures the implementer can't ship one without
//     the other.
//
//   To guarantee RED today, subtest 1 fails immediately (new fields absent),
//   which also makes the group fail.  Subtest 2 is a forward-looking guard.
// ---------------------------------------------------------------------------

describe('validateSchema passes settings without new fields (backward compat)', () => {
  let tmpRoot;
  let settings;

  before(() => {
    // Arrange — project root with only the old v0.0.1-A settings file on disk.
    tmpRoot = makeTmpProjectWithCurrentSettings();

    // Act — readUserSettings must merge defaults for absent new fields.
    settings = readUserSettings(tmpRoot);
  });

  after(() => {
    rmrf(tmpRoot);
  });

  it('should supply all 4 new-field defaults when reading a v0.0.1-A file', () => {
    // Assert — each new top-level key must be present with the correct value.
    // FAILS RED: readUserSettings returns the raw file with no default merging,
    // so none of these keys exist in the result.
    for (const [key, expectedValue] of Object.entries(NEW_FIELD_DEFAULTS)) {
      assert.ok(
        key in settings,
        `readUserSettings must supply default for "${key}" when absent from file`
      );
      assert.deepEqual(
        settings[key],
        expectedValue,
        `default value for "${key}" must match v0.0.1-B spec`
      );
    }
  });

  it('should pass validateSchema after default-merge of a v0.0.1-A file', () => {
    // Act — validate the merged result against the updated schema.
    const result = validateSchema('user_settings', settings);

    // Assert — backward compat: old file + default merging → passes updated schema.
    // FAILS RED now because:
    //   (a) readUserSettings has not merged defaults (new fields absent), AND
    //   (b) once the schema is made stricter in GREEN, a raw v0.0.1-A object
    //       would fail schema validation unless defaults were merged first.
    assert.equal(
      result.valid,
      true,
      `backward-compat validation must pass after default merge; errors: ${JSON.stringify(result.errors)}`
    );
    assert.deepEqual(result.errors, []);
  });
});
