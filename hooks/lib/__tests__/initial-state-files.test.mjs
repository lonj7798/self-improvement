/**
 * initial-state-files.test.mjs
 * RED phase tests for Task 2.3 — Create initial state files.
 *
 * These 3 tests validate that the following files/directories were physically
 * created in the repository as part of the GREEN phase:
 *
 *   docs/agent_defined/teammate_registry.json
 *   docs/agent_defined/notebook.json
 *   docs/agent_defined/findings/          (directory)
 *
 * The tests import readRegistry from registry-io.mjs and readJSON /
 * validateSchema from state-io.mjs (both already implemented) and exercise
 * them against the REAL project root path — not a temp directory — so that
 * a missing file causes a test failure rather than a graceful default.
 *
 * Expected RED-phase failure reason for every test:
 *   docs/agent_defined/ does not exist yet; the files are absent.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/initial-state-files.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { readRegistry } from '../registry-io.mjs';
import { readJSON, validateSchema } from '../state-io.mjs';

// ---------------------------------------------------------------------------
// Project root — the repo root where docs/agent_defined/ will be created.
// Path ancestry from this file:
//   __tests__/  --(..)--> lib/  --(..)--> hooks/  --(..)--> self-improvement/  --(..)--> self-improvement-dev/
// Four levels up from the directory containing this file reaches the repo root.
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(
  new URL('.', import.meta.url).pathname,  // .../self-improvement/hooks/lib/__tests__/
  '..', '..', '..', '..'                   // four levels up → self-improvement-dev/
);

// Derived paths used directly in tests for precise failure messages.
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'docs', 'agent_defined', 'teammate_registry.json');
const NOTEBOOK_PATH = path.join(PROJECT_ROOT, 'docs', 'agent_defined', 'notebook.json');
const FINDINGS_DIR  = path.join(PROJECT_ROOT, 'docs', 'agent_defined', 'findings');

// ---------------------------------------------------------------------------
// Test 1 — teammate_registry.json exists and has valid schema
// ---------------------------------------------------------------------------

describe('teammate_registry.json initial state file', () => {
  it('should return valid registry structure when file exists on disk', async () => {
    // Arrange — the file must already exist at REGISTRY_PATH (created in GREEN phase).
    // If the file is absent, readRegistry returns a synthesised default and the
    // schema check below will pass — so we first assert the file is present.
    assert.ok(
      fs.existsSync(REGISTRY_PATH),
      `teammate_registry.json must exist at: ${REGISTRY_PATH}`
    );

    // Act — read the registry through the production module.
    const registry = await readRegistry(PROJECT_ROOT);

    // Assert — structure is correct.
    assert.ok(registry !== null, 'readRegistry must return a non-null object');
    assert.ok(Array.isArray(registry.teammates), 'teammates must be an array');
    assert.equal(registry.teammates.length, 0, 'initial teammates array must be empty');
    assert.ok('updated_at' in registry, 'updated_at field must be present');

    // Assert — schema validation passes.
    const { valid, errors } = validateSchema('teammate_registry', registry);
    assert.equal(
      valid,
      true,
      `validateSchema must pass for the initial registry; errors: ${JSON.stringify(errors)}`
    );
    assert.deepEqual(errors, []);
  });
});

// ---------------------------------------------------------------------------
// Test 2 — notebook.json exists and has valid schema
// ---------------------------------------------------------------------------

describe('notebook.json initial state file', () => {
  it('should return valid notebook structure when file exists on disk', () => {
    // Arrange — the file must already exist at NOTEBOOK_PATH (created in GREEN phase).
    // readJSON returns null for a missing file; we assert existence first so the
    // failure message is clear rather than a confusing "null" assertion error.
    assert.ok(
      fs.existsSync(NOTEBOOK_PATH),
      `notebook.json must exist at: ${NOTEBOOK_PATH}`
    );

    // Act — read the raw JSON through the production module.
    const notebook = readJSON(NOTEBOOK_PATH);

    // Assert — file parses successfully.
    assert.ok(notebook !== null, 'readJSON must return a non-null object for notebook.json');

    // Assert — each required field is present with the correct initial value.
    assert.equal(notebook.planner_id, null, 'planner_id must be null initially');
    assert.ok(Array.isArray(notebook.rounds_active), 'rounds_active must be an array');
    assert.equal(notebook.rounds_active.length, 0, 'rounds_active must be empty initially');
    assert.equal(notebook.streak, 0, 'streak must be 0 initially');
    assert.ok(Array.isArray(notebook.observations), 'observations must be an array');
    assert.equal(notebook.observations.length, 0, 'observations must be empty initially');
    assert.ok(Array.isArray(notebook.dead_ends), 'dead_ends must be an array');
    assert.equal(notebook.dead_ends.length, 0, 'dead_ends must be empty initially');
    assert.equal(notebook.current_theory, null, 'current_theory must be null initially');

    // Assert — schema validation passes.
    const { valid, errors } = validateSchema('notebook', notebook);
    assert.equal(
      valid,
      true,
      `validateSchema must pass for the initial notebook; errors: ${JSON.stringify(errors)}`
    );
    assert.deepEqual(errors, []);
  });
});

// ---------------------------------------------------------------------------
// Test 3 — findings/ directory exists
// ---------------------------------------------------------------------------

describe('findings/ initial directory', () => {
  it('should exist as a directory on disk', () => {
    // Arrange — no setup required; this test checks the real filesystem.

    // Act — stat the path.
    let stat;
    try {
      stat = fs.statSync(FINDINGS_DIR);
    } catch {
      stat = null;
    }

    // Assert — path must exist and be a directory.
    assert.ok(
      stat !== null,
      `findings/ directory must exist at: ${FINDINGS_DIR}`
    );
    assert.ok(
      stat.isDirectory(),
      `findings/ must be a directory, not a file, at: ${FINDINGS_DIR}`
    );
  });
});
