/**
 * team-manager-contracts.test.mjs
 * RED phase tests for Task 3.1: si-team-manager skill contracts.
 *
 * These tests verify the REGISTRY-LEVEL SIDE EFFECTS that each si-team-manager
 * command must produce. They do not test the SKILL.md Markdown itself; they
 * test the data-layer contracts (teammate_registry.json, agent_defined/settings.json,
 * and notebook.json) that the skill's commands are required to produce.
 *
 * ../team-manager.mjs does NOT YET EXIST. Each test loads it via dynamic import
 * inside the test body; the import rejects with ERR_MODULE_NOT_FOUND, which
 * causes every individual test to fail with the correct "not implemented" reason.
 *
 * Framework: Node.js built-in node:test + node:assert/strict
 * Run (from self-improvement/):
 *   node --test hooks/lib/__tests__/team-manager-contracts.test.mjs
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Read-only helpers from existing, implemented modules.
// Used ONLY in Arrange and Assert sections — never in Act.
// ---------------------------------------------------------------------------

import { readRegistry } from '../registry-io.mjs';
import { readJSON, readAgentSettings } from '../state-io.mjs';

// ---------------------------------------------------------------------------
// Lazy loader for the unimplemented module.
//
// team-manager.mjs is the JavaScript implementation that backs the
// si-team-manager skill commands. It does not exist yet. Each test calls
// loadTM() in its Act section; that dynamic import rejects with
// ERR_MODULE_NOT_FOUND, causing the test to fail for the correct reason.
//
// Using a dynamic import (rather than a static top-level import) prevents
// the module-not-found error from crashing the whole file at load time,
// which would collapse all 11 tests into a single suite error. This way
// each test fails individually with a clear ERR_MODULE_NOT_FOUND message.
// ---------------------------------------------------------------------------

const TM_PATH = new URL('../team-manager.mjs', import.meta.url).href;

async function loadTM() {
  // Dynamic import — rejects with ERR_MODULE_NOT_FOUND until the GREEN phase
  // creates hooks/lib/team-manager.mjs.
  return import(TM_PATH);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'team-manager-contracts-'));
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function seedRegistry(projectRoot, registry) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'teammate_registry.json');
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(registry, null, 2), 'utf8');
}

function seedAgentSettings(projectRoot, settings) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'settings.json');
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(settings, null, 2), 'utf8');
}

function seedNotebook(projectRoot, notebook) {
  const fp = path.join(projectRoot, 'docs', 'agent_defined', 'notebook.json');
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(notebook, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONTINUATION_PLANNER = {
  id: 'planner-cont-abc123',
  role: 'continuation',
  label: 'planner_a',
  round_created: 1,
  streak: 2,
  status: 'active',
};

const CHALLENGER_PLANNER_1 = {
  id: 'planner-chal-def456',
  role: 'challenger',
  label: 'planner_b',
  round_created: 3,
  streak: 0,
  status: 'active',
};

const CHALLENGER_PLANNER_2 = {
  id: 'planner-chal-ghi789',
  role: 'challenger',
  label: 'planner_c',
  round_created: 3,
  streak: 0,
  status: 'active',
};

function makeAgentSettings(overrides = {}) {
  return {
    iterations: 3,
    si_setting_goal: true,
    si_setting_benchmark: true,
    si_setting_harness: true,
    best_score: 0.85,
    current_milestone: null,
    current_phase: null,
    plateau_consecutive_count: 0,
    circuit_breaker_count: 0,
    status: 'running',
    continuation: {
      planner_id: CONTINUATION_PLANNER.id,
      streak: 2,
      notebook_path: 'docs/agent_defined/notebook.json',
    },
    retrospection_state: { last_round: null, reshaped: false, reshape_trigger_round: null },
    recent_winners: [],
    hybrid_stats: { total: 3, wins: 2, skips: 1 },
    ...overrides,
  };
}

const RICH_NOTEBOOK = {
  planner_id: CONTINUATION_PLANNER.id,
  rounds_active: [1, 2, 3],
  streak: 2,
  observations: [
    { round: 1, note: 'Tried momentum scheduling; marginal gain.' },
    { round: 2, note: 'Gradient clipping helped stability.' },
  ],
  dead_ends: ['batch size > 256 causes OOM on target hardware'],
  current_theory: 'Learning rate warm-up is the key lever for this benchmark.',
};

// ---------------------------------------------------------------------------
// Test Group 1: create command — adds teammate to registry
// ---------------------------------------------------------------------------

describe('create command adds teammate to registry', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedRegistry(tmpDir, { teammates: [], updated_at: new Date().toISOString() });
  });

  after(() => { rmrf(tmpDir); });

  it('should increase registry length by one and store correct role round and status when teammate is added', async () => {
    // Arrange
    const params = { role: 'challenger', label: 'planner_b', round: 2 };

    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { createTeammate } = await loadTM();
    await createTeammate(tmpDir, params);

    // Assert
    const registry = await readRegistry(tmpDir);
    assert.equal(registry.teammates.length, 1, 'registry must contain exactly one entry after create');
    const stored = registry.teammates[0];
    assert.equal(stored.role, 'challenger', 'stored entry must carry role=challenger');
    assert.equal(stored.round_created, 2, 'stored entry must carry round_created=2');
    assert.equal(stored.status, 'active', 'stored entry must have status "active"');
    assert.equal(stored.label, 'planner_b', 'stored entry must carry label=planner_b');
    assert.ok(typeof stored.id === 'string' && stored.id.length > 0, 'stored entry must have a non-empty id');
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: create continuation — rejects if one already exists
// ---------------------------------------------------------------------------

describe('create continuation rejects if one already exists', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedRegistry(tmpDir, {
      teammates: [CONTINUATION_PLANNER],
      updated_at: new Date().toISOString(),
    });
  });

  after(() => { rmrf(tmpDir); });

  it('should throw an error when adding a second continuation planner', async () => {
    // Arrange
    const params = { role: 'continuation', label: 'planner_d', round: 5 };

    // Act + Assert — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { createTeammate } = await loadTM();
    await assert.rejects(
      async () => createTeammate(tmpDir, params),
      (err) => {
        assert.ok(err instanceof Error, 'rejection must be an Error instance');
        assert.ok(
          err.message.toLowerCase().includes('continuation'),
          `error message must mention "continuation"; got: "${err.message}"`
        );
        return true;
      }
    );

    // Assert — registry still has exactly one continuation entry
    const registry = await readRegistry(tmpDir);
    const continuationEntries = registry.teammates.filter((t) => t.role === 'continuation');
    assert.equal(
      continuationEntries.length,
      1,
      'registry must still contain exactly one continuation planner after rejected create'
    );
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: kill command — removes teammate from registry
// ---------------------------------------------------------------------------

describe('kill command removes teammate from registry', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    seedRegistry(tmpDir, {
      teammates: [CONTINUATION_PLANNER, CHALLENGER_PLANNER_1],
      updated_at: new Date().toISOString(),
    });
    seedAgentSettings(tmpDir, makeAgentSettings());
  });

  after(() => { rmrf(tmpDir); });

  it('should decrease registry length by one and remove the killed id when kill is called', async () => {
    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { killTeammate } = await loadTM();
    await killTeammate(tmpDir, { id: CHALLENGER_PLANNER_1.id });

    // Assert
    const registry = await readRegistry(tmpDir);
    assert.equal(registry.teammates.length, 1, 'registry must contain one fewer entry after kill');
    const killed = registry.teammates.find((t) => t.id === CHALLENGER_PLANNER_1.id);
    assert.equal(killed, undefined, 'killed teammate must not be present in the registry');
    const remaining = registry.teammates.find((t) => t.id === CONTINUATION_PLANNER.id);
    assert.ok(remaining !== undefined, 'non-killed teammate must still be present in the registry');
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: kill updates agent_settings continuation to null
// ---------------------------------------------------------------------------

describe('kill updates agent_settings continuation to null', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedRegistry(tmpDir, {
      teammates: [CONTINUATION_PLANNER],
      updated_at: new Date().toISOString(),
    });
    seedAgentSettings(tmpDir, makeAgentSettings());
  });

  after(() => { rmrf(tmpDir); });

  it('should set continuation planner_id to null in settings when the continuation planner is killed', async () => {
    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { killTeammate } = await loadTM();
    await killTeammate(tmpDir, { id: CONTINUATION_PLANNER.id });

    // Assert
    const settings = readAgentSettings(tmpDir);
    assert.ok(
      'continuation' in settings,
      'settings must still contain a "continuation" section after killing the continuation planner'
    );
    assert.equal(
      settings.continuation.planner_id,
      null,
      'continuation.planner_id must be null after the continuation planner is killed'
    );
    assert.ok(
      'streak' in settings.continuation,
      'continuation.streak field must still be present after kill'
    );
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: handoff — challenger wins, promotes to continuation
// ---------------------------------------------------------------------------

describe('handoff: challenger wins - promotes to continuation', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedRegistry(tmpDir, {
      teammates: [CONTINUATION_PLANNER, CHALLENGER_PLANNER_1, CHALLENGER_PLANNER_2],
      updated_at: new Date().toISOString(),
    });
    seedAgentSettings(tmpDir, makeAgentSettings());
    seedNotebook(tmpDir, RICH_NOTEBOOK);
  });

  after(() => { rmrf(tmpDir); });

  it('should remove old continuation promote winner to continuation with streak 1 and remove other challengers', async () => {
    // Arrange
    const params = {
      winner_id: CHALLENGER_PLANNER_1.id,
      round: 4,
      score_before: 0.85,
      score_after: 0.91,
    };

    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { handoff } = await loadTM();
    await handoff(tmpDir, params);

    // Assert — registry: only promoted winner remains
    const registry = await readRegistry(tmpDir);
    assert.equal(
      registry.teammates.length,
      1,
      'registry must contain exactly one entry after challenger-wins handoff'
    );
    const promoted = registry.teammates.find((t) => t.id === CHALLENGER_PLANNER_1.id);
    assert.ok(promoted !== undefined, 'promoted winner must be present in the registry');
    assert.equal(promoted.role, 'continuation', 'promoted winner must have role "continuation"');
    assert.equal(promoted.streak, 1, 'promoted winner must have streak set to 1');
    const oldCont = registry.teammates.find((t) => t.id === CONTINUATION_PLANNER.id);
    assert.equal(oldCont, undefined, 'old continuation planner must be removed from the registry');
    const otherChallenger = registry.teammates.find((t) => t.id === CHALLENGER_PLANNER_2.id);
    assert.equal(otherChallenger, undefined, 'other challenger must be removed from the registry');

    // Assert — settings updated
    const settings = readAgentSettings(tmpDir);
    assert.equal(
      settings.continuation.planner_id,
      CHALLENGER_PLANNER_1.id,
      'settings.continuation.planner_id must point to the promoted challenger'
    );
    assert.equal(
      settings.continuation.streak,
      1,
      'settings.continuation.streak must be reset to 1 after challenger promotion'
    );
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: handoff — continuation wins, streak increments
// ---------------------------------------------------------------------------

describe('handoff: continuation wins - streak increments', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedRegistry(tmpDir, {
      teammates: [CONTINUATION_PLANNER, CHALLENGER_PLANNER_1],
      updated_at: new Date().toISOString(),
    });
    seedAgentSettings(tmpDir, makeAgentSettings({
      continuation: {
        planner_id: CONTINUATION_PLANNER.id,
        streak: 1,
        notebook_path: 'docs/agent_defined/notebook.json',
      },
    }));
  });

  after(() => { rmrf(tmpDir); });

  it('should increment continuation streak by 1 and remove all challengers from registry', async () => {
    // Arrange — capture streak before act
    const settingsBefore = readAgentSettings(tmpDir);
    const streakBefore = settingsBefore.continuation.streak;

    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { handoff } = await loadTM();
    await handoff(tmpDir, {
      winner_id: CONTINUATION_PLANNER.id,
      round: 4,
      score_before: 0.85,
      score_after: 0.87,
    });

    // Assert — registry: only continuation planner remains
    const registry = await readRegistry(tmpDir);
    assert.equal(
      registry.teammates.length,
      1,
      'registry must contain only the continuation planner after continuation-wins handoff'
    );
    const cont = registry.teammates.find((t) => t.id === CONTINUATION_PLANNER.id);
    assert.ok(cont !== undefined, 'continuation planner must still be in the registry');
    const challenger = registry.teammates.find((t) => t.id === CHALLENGER_PLANNER_1.id);
    assert.equal(challenger, undefined, 'challenger must be removed from the registry');

    // Assert — settings streak incremented
    const settingsAfter = readAgentSettings(tmpDir);
    assert.equal(
      settingsAfter.continuation.streak,
      streakBefore + 1,
      `streak must be ${streakBefore + 1} after continuation wins (was ${streakBefore})`
    );
    assert.equal(
      settingsAfter.continuation.planner_id,
      CONTINUATION_PLANNER.id,
      'continuation.planner_id must not change when continuation planner wins'
    );
  });
});

// ---------------------------------------------------------------------------
// Test Group 7: handoff — streak >= 3 forces rotation
// ---------------------------------------------------------------------------

describe('handoff: streak >= 3 - force rotation', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const contAtMaxStreak = { ...CONTINUATION_PLANNER, streak: 3 };
    seedRegistry(tmpDir, {
      teammates: [contAtMaxStreak, CHALLENGER_PLANNER_1],
      updated_at: new Date().toISOString(),
    });
    seedAgentSettings(tmpDir, makeAgentSettings({
      continuation: {
        planner_id: CONTINUATION_PLANNER.id,
        streak: 3,
        notebook_path: 'docs/agent_defined/notebook.json',
      },
    }));
    seedNotebook(tmpDir, RICH_NOTEBOOK);
  });

  after(() => { rmrf(tmpDir); });

  it('should remove all teammates from registry and reset continuation to null with streak 0 when streak is 3', async () => {
    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { handoff } = await loadTM();
    await handoff(tmpDir, {
      winner_id: CONTINUATION_PLANNER.id,
      round: 5,
      score_before: 0.92,
      score_after: 0.93,
    });

    // Assert — registry is empty
    const registry = await readRegistry(tmpDir);
    assert.equal(registry.teammates.length, 0, 'registry must be empty after force rotation');

    // Assert — settings continuation fully reset
    const settings = readAgentSettings(tmpDir);
    assert.equal(settings.continuation.planner_id, null, 'continuation.planner_id must be null after force rotation');
    assert.equal(settings.continuation.streak, 0, 'continuation.streak must be 0 after force rotation');
    assert.equal(settings.continuation.notebook_path, null, 'continuation.notebook_path must be null after force rotation');
  });
});

// ---------------------------------------------------------------------------
// Test Group 8: handoff force rotation archives notebook
// ---------------------------------------------------------------------------

describe('handoff: force rotation archives notebook', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const contAtMaxStreak = { ...CONTINUATION_PLANNER, streak: 3 };
    seedRegistry(tmpDir, {
      teammates: [contAtMaxStreak, CHALLENGER_PLANNER_1],
      updated_at: new Date().toISOString(),
    });
    seedAgentSettings(tmpDir, makeAgentSettings({
      continuation: {
        planner_id: CONTINUATION_PLANNER.id,
        streak: 3,
        notebook_path: 'docs/agent_defined/notebook.json',
      },
    }));
    seedNotebook(tmpDir, RICH_NOTEBOOK);
  });

  after(() => { rmrf(tmpDir); });

  it('should copy notebook.json to notebooks/round_N.json before clearing registry on force rotation', async () => {
    // Arrange — record notebook content before handoff
    const notebookPath = path.join(tmpDir, 'docs', 'agent_defined', 'notebook.json');
    const notebookBefore = readJSON(notebookPath);
    const round = 5;

    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { handoff } = await loadTM();
    await handoff(tmpDir, {
      winner_id: CONTINUATION_PLANNER.id,
      round,
      score_before: 0.92,
      score_after: 0.93,
    });

    // Assert — archive file exists at the correct path
    const archivePath = path.join(tmpDir, 'docs', 'agent_defined', 'notebooks', `round_${round}.json`);
    assert.ok(fs.existsSync(archivePath), `notebook archive must exist at: ${archivePath}`);

    // Assert — archive content matches the pre-handoff notebook
    const archived = readJSON(archivePath);
    assert.ok(archived !== null, 'archived notebook must be valid JSON');
    assert.equal(archived.planner_id, notebookBefore.planner_id, 'archived notebook must preserve the original planner_id');
    assert.equal(archived.observations.length, notebookBefore.observations.length, 'archived notebook must preserve the original observations array length');
    assert.equal(archived.current_theory, notebookBefore.current_theory, 'archived notebook must preserve the original current_theory');
  });
});

// ---------------------------------------------------------------------------
// Test Group 9: notebook archive creates correct file in notebooks/ directory
// ---------------------------------------------------------------------------

describe('notebook archive creates timestamped copy', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedNotebook(tmpDir, {
      planner_id: 'planner-cont-abc123',
      rounds_active: [1, 2],
      streak: 2,
      observations: [{ round: 1, note: 'Initial exploration.' }],
      dead_ends: [],
      current_theory: 'Smaller batch sizes improve generalisation here.',
    });
  });

  after(() => { rmrf(tmpDir); });

  it('should create notebooks/round_N.json with content matching notebook.json at the time of archival', async () => {
    // Arrange — record source content before the call
    const notebookPath = path.join(tmpDir, 'docs', 'agent_defined', 'notebook.json');
    const srcContent = readJSON(notebookPath);
    const round = 3;

    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { archiveNotebook } = await loadTM();
    const result = await archiveNotebook(tmpDir, { round });

    // Assert — returned archive_path exists
    assert.ok(typeof result.archive_path === 'string', 'archiveNotebook must return an object with an archive_path string');
    assert.ok(fs.existsSync(result.archive_path), `archive file must exist at the returned path: ${result.archive_path}`);

    // Assert — archive is in the notebooks/ directory with correct filename
    const expectedDir = path.join(tmpDir, 'docs', 'agent_defined', 'notebooks');
    assert.ok(result.archive_path.startsWith(expectedDir), `archive path "${result.archive_path}" must be inside the notebooks/ directory`);
    assert.equal(path.basename(result.archive_path), `round_${round}.json`, `archive filename must be "round_${round}.json"`);

    // Assert — content matches source
    const archived = readJSON(result.archive_path);
    assert.ok(archived !== null, 'archived file must parse as valid JSON');
    assert.deepEqual(archived, srcContent, 'archived notebook content must be identical to the source notebook at time of archival');
  });
});

// ---------------------------------------------------------------------------
// Test Group 10: notebook archive resets current notebook.json
// ---------------------------------------------------------------------------

describe('notebook archive resets current notebook', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedNotebook(tmpDir, {
      planner_id: 'planner-cont-abc123',
      rounds_active: [1, 2, 3],
      streak: 3,
      observations: [
        { round: 1, note: 'Baseline established.' },
        { round: 2, note: 'Warm-up helped.' },
        { round: 3, note: 'Plateau hit.' },
      ],
      dead_ends: ['fixed LR schedule underperforms cyclic'],
      current_theory: 'Need architectural change, not just LR tuning.',
    });
  });

  after(() => { rmrf(tmpDir); });

  it('should reset notebook.json to the empty structure after archival', async () => {
    // Arrange
    const notebookPath = path.join(tmpDir, 'docs', 'agent_defined', 'notebook.json');
    const round = 4;

    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { archiveNotebook } = await loadTM();
    await archiveNotebook(tmpDir, { round });

    // Assert — notebook.json reset to empty structure
    const reset = readJSON(notebookPath);
    assert.ok(reset !== null, 'notebook.json must still be valid JSON after reset');
    assert.equal(reset.planner_id, null, 'planner_id must be null in reset notebook');
    assert.ok(Array.isArray(reset.rounds_active) && reset.rounds_active.length === 0, 'rounds_active must be an empty array in reset notebook');
    assert.equal(reset.streak, 0, 'streak must be 0 in reset notebook');
    assert.ok(Array.isArray(reset.observations) && reset.observations.length === 0, 'observations must be an empty array in reset notebook');
    assert.ok(Array.isArray(reset.dead_ends) && reset.dead_ends.length === 0, 'dead_ends must be an empty array in reset notebook');
    assert.equal(reset.current_theory, null, 'current_theory must be null in reset notebook');

    // Assert — archive file still holds original content (reset must not corrupt the archive)
    const archivePath = path.join(tmpDir, 'docs', 'agent_defined', 'notebooks', `round_${round}.json`);
    const archived = readJSON(archivePath);
    assert.ok(archived !== null, 'archive file must still be valid JSON after notebook is reset');
    assert.equal(archived.planner_id, 'planner-cont-abc123', 'archive must preserve the original planner_id even after notebook is reset');
    assert.equal(archived.observations.length, 3, 'archive must preserve the original observations count even after notebook is reset');
  });
});

// ---------------------------------------------------------------------------
// Test Group 11: list returns formatted teammate entries
// ---------------------------------------------------------------------------

describe('list returns formatted teammate entries', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    seedRegistry(tmpDir, {
      teammates: [
        CONTINUATION_PLANNER,
        CHALLENGER_PLANNER_1,
        { ...CHALLENGER_PLANNER_2, status: 'dead' },
      ],
      updated_at: new Date().toISOString(),
    });
  });

  after(() => { rmrf(tmpDir); });

  it('should return active entries where each entry exposes its id and role', async () => {
    // Act — loadTM() rejects with ERR_MODULE_NOT_FOUND in RED phase
    const { listTeammates } = await loadTM();
    const entries = await listTeammates(tmpDir);

    // Assert — exactly two active entries returned
    assert.ok(Array.isArray(entries), 'listTeammates must return an array');
    assert.equal(entries.length, 2, 'listTeammates must return exactly 2 active entries (third entry is dead)');

    // Assert — each entry exposes id and role
    for (const entry of entries) {
      assert.ok(typeof entry.id === 'string' && entry.id.length > 0, `each active entry must have a non-empty string id; got: ${JSON.stringify(entry.id)}`);
      assert.ok(typeof entry.role === 'string' && entry.role.length > 0, `each active entry must have a non-empty string role; got: ${JSON.stringify(entry.role)}`);
      assert.equal(entry.status, 'active', `every returned entry must have status "active"; got: "${entry.status}"`);
    }

    // Assert — correct entries present
    const contEntry = entries.find((t) => t.id === CONTINUATION_PLANNER.id);
    assert.ok(contEntry !== undefined, 'continuation planner must appear in the list');
    assert.equal(contEntry.role, 'continuation', 'continuation planner entry must have role "continuation"');

    const chalEntry = entries.find((t) => t.id === CHALLENGER_PLANNER_1.id);
    assert.ok(chalEntry !== undefined, 'challenger planner must appear in the list');
    assert.equal(chalEntry.role, 'challenger', 'challenger planner entry must have role "challenger"');

    // Assert — dead teammate excluded
    const deadEntry = entries.find((t) => t.id === CHALLENGER_PLANNER_2.id);
    assert.equal(deadEntry, undefined, 'dead teammate must not appear in the list returned by listTeammates');
  });
});
