/**
 * registry-io.test.mjs
 * RED phase tests for self-improvement/hooks/lib/registry-io.mjs
 * All 12 tests must FAIL until the implementation file is created.
 *
 * Run: node --test hooks/lib/__tests__/registry-io.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Import from the module that does NOT exist yet — this is the RED phase.
// Every test will fail at module-load time with ERR_MODULE_NOT_FOUND.
import {
  readRegistry,
  writeRegistry,
  addTeammate,
  removeTeammate,
  getTeammateByRole,
  listActiveTeammates,
  updateTeammateStatus,
} from '../registry-io.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a unique temporary directory per test group so tests are
 * fully isolated regardless of execution order.
 */
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'registry-io-test-'));
}

/**
 * Recursively remove a directory (Node 14+ compatible).
 */
function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Return the canonical registry file path for a given projectRoot.
 * Mirrors the path logic the implementation must follow.
 */
function registryPath(projectRoot) {
  return path.join(projectRoot, 'docs', 'agent_defined', 'teammate_registry.json');
}

/**
 * Write a registry object directly to disk in the correct location.
 * Used for Arrange steps that need a pre-existing registry file.
 */
function seedRegistry(projectRoot, registry) {
  const fp = registryPath(projectRoot);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * Read the registry file directly from disk without going through the module.
 * Used for Assert steps that need to verify the file content independently.
 */
function loadRaw(projectRoot) {
  return JSON.parse(fs.readFileSync(registryPath(projectRoot), 'utf8'));
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const TEAMMATE_RESEARCHER = {
  id: 'agent-researcher-001',
  role: 'researcher',
  status: 'active',
  session_id: 'sess-aaa',
  started_at: '2024-03-01T10:00:00.000Z',
};

const TEAMMATE_PLANNER = {
  id: 'agent-planner-002',
  role: 'planner',
  status: 'active',
  session_id: 'sess-bbb',
  started_at: '2024-03-01T10:05:00.000Z',
};

const TEAMMATE_EXECUTOR_DEAD = {
  id: 'agent-executor-003',
  role: 'executor',
  status: 'dead',
  session_id: 'sess-ccc',
  started_at: '2024-03-01T09:00:00.000Z',
};

const TEAMMATE_EXECUTOR_IDLE = {
  id: 'agent-executor-004',
  role: 'executor',
  status: 'idle',
  session_id: 'sess-ddd',
  started_at: '2024-03-01T09:30:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests: readRegistry
// ---------------------------------------------------------------------------

describe('readRegistry', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Ensure the docs/agent_defined directory exists but NO registry file
    fs.mkdirSync(path.join(tmpDir, 'docs', 'agent_defined'), { recursive: true });
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return empty teammates array and updated_at when registry file is missing', async () => {
    // Arrange — no registry file on disk in tmpDir

    // Act
    const result = await readRegistry(tmpDir);

    // Assert
    assert.ok(result !== null, 'result must not be null');
    assert.ok(Array.isArray(result.teammates), 'teammates must be an array');
    assert.equal(result.teammates.length, 0, 'teammates must be empty for missing file');
    assert.ok('updated_at' in result, 'updated_at field must be present');
  });

  it('should return parsed registry with teammates array when file exists', async () => {
    // Arrange — seed a registry with two teammates
    const tmpDir2 = makeTmpDir();
    const registry = {
      teammates: [TEAMMATE_RESEARCHER, TEAMMATE_PLANNER],
      updated_at: '2024-03-01T12:00:00.000Z',
    };
    seedRegistry(tmpDir2, registry);

    // Act
    const result = await readRegistry(tmpDir2);

    // Assert
    assert.equal(result.teammates.length, 2);
    assert.deepEqual(result.teammates[0], TEAMMATE_RESEARCHER);
    assert.deepEqual(result.teammates[1], TEAMMATE_PLANNER);

    rmrf(tmpDir2);
  });
});

// ---------------------------------------------------------------------------
// Tests: writeRegistry
// ---------------------------------------------------------------------------

describe('writeRegistry', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should create a file whose content matches the registry object written', async () => {
    // Arrange
    const registry = {
      teammates: [TEAMMATE_RESEARCHER],
      updated_at: '2024-03-01T11:00:00.000Z',
    };

    // Act
    await writeRegistry(tmpDir, registry);

    // Assert — file must exist and content must round-trip exactly
    assert.ok(fs.existsSync(registryPath(tmpDir)), 'registry file must exist after writeRegistry');
    const onDisk = loadRaw(tmpDir);
    assert.deepEqual(onDisk, registry);
  });
});

// ---------------------------------------------------------------------------
// Tests: addTeammate
// ---------------------------------------------------------------------------

describe('addTeammate', () => {
  let tmpDir;

  beforeEach(() => {
    // Fresh isolated directory for every test in this group
    tmpDir = makeTmpDir();
  });

  after(() => {
    // Final cleanup — individual dirs cleaned per test via beforeEach recreation
    rmrf(tmpDir);
  });

  it('should append entry and increase teammates length by one when registry exists', async () => {
    // Arrange — registry with one existing teammate
    const initial = {
      teammates: [TEAMMATE_RESEARCHER],
      updated_at: '2024-03-01T10:00:00.000Z',
    };
    seedRegistry(tmpDir, initial);

    // Act
    await addTeammate(tmpDir, TEAMMATE_PLANNER);

    // Assert
    const result = loadRaw(tmpDir);
    assert.equal(result.teammates.length, 2, 'length must increase by 1');
    const added = result.teammates.find((t) => t.id === TEAMMATE_PLANNER.id);
    assert.ok(added !== undefined, 'added entry must be present in registry');
    assert.deepEqual(added, TEAMMATE_PLANNER);
    // Original entry preserved
    const original = result.teammates.find((t) => t.id === TEAMMATE_RESEARCHER.id);
    assert.ok(original !== undefined, 'pre-existing entry must still be present');
  });

  it('should throw or reject when adding a teammate with a duplicate id', async () => {
    // Arrange — registry already contains TEAMMATE_RESEARCHER
    const initial = {
      teammates: [TEAMMATE_RESEARCHER],
      updated_at: '2024-03-01T10:00:00.000Z',
    };
    seedRegistry(tmpDir, initial);

    // Act + Assert — must throw (sync) or reject (async) for duplicate ID
    const duplicate = { ...TEAMMATE_RESEARCHER, session_id: 'sess-zzz' };
    await assert.rejects(
      async () => addTeammate(tmpDir, duplicate),
      (err) => {
        assert.ok(err instanceof Error, 'rejection value must be an Error instance');
        return true;
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: removeTeammate
// ---------------------------------------------------------------------------

describe('removeTeammate', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should decrease teammates length by one when id exists', async () => {
    // Arrange — registry with two teammates
    const initial = {
      teammates: [TEAMMATE_RESEARCHER, TEAMMATE_PLANNER],
      updated_at: '2024-03-01T10:00:00.000Z',
    };
    seedRegistry(tmpDir, initial);

    // Act
    await removeTeammate(tmpDir, TEAMMATE_RESEARCHER.id);

    // Assert
    const result = loadRaw(tmpDir);
    assert.equal(result.teammates.length, 1, 'length must decrease by 1');
    const removed = result.teammates.find((t) => t.id === TEAMMATE_RESEARCHER.id);
    assert.equal(removed, undefined, 'removed entry must not be present');
    // Remaining entry preserved
    const remaining = result.teammates.find((t) => t.id === TEAMMATE_PLANNER.id);
    assert.ok(remaining !== undefined, 'remaining entry must still be present');
  });

  it('should not throw and leave length unchanged when id does not exist', async () => {
    // Arrange — registry with one teammate
    const initial = {
      teammates: [TEAMMATE_RESEARCHER],
      updated_at: '2024-03-01T10:00:00.000Z',
    };
    seedRegistry(tmpDir, initial);

    // Act — non-existent ID
    await assert.doesNotReject(
      async () => removeTeammate(tmpDir, 'non-existent-id-xyz')
    );

    // Assert — length unchanged
    const result = loadRaw(tmpDir);
    assert.equal(result.teammates.length, 1, 'teammates length must be unchanged');
  });
});

// ---------------------------------------------------------------------------
// Tests: getTeammateByRole
// ---------------------------------------------------------------------------

describe('getTeammateByRole', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    const registry = {
      teammates: [TEAMMATE_RESEARCHER, TEAMMATE_PLANNER, TEAMMATE_EXECUTOR_DEAD],
      updated_at: '2024-03-01T12:00:00.000Z',
    };
    seedRegistry(tmpDir, registry);
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return the first teammate entry that matches the given role', async () => {
    // Act
    const result = await getTeammateByRole(tmpDir, 'researcher');

    // Assert
    assert.ok(result !== null, 'result must not be null for an existing role');
    assert.equal(result.role, 'researcher');
    assert.equal(result.id, TEAMMATE_RESEARCHER.id);
  });

  it('should return null when no teammate has the given role', async () => {
    // Act
    const result = await getTeammateByRole(tmpDir, 'tournament-judge');

    // Assert
    assert.equal(result, null, 'must return null for a role that does not exist');
  });
});

// ---------------------------------------------------------------------------
// Tests: listActiveTeammates
// ---------------------------------------------------------------------------

describe('listActiveTeammates', () => {
  let tmpDir;

  before(() => {
    tmpDir = makeTmpDir();
    // Registry with 2 active, 1 dead, 1 idle
    const registry = {
      teammates: [
        TEAMMATE_RESEARCHER,
        TEAMMATE_PLANNER,
        TEAMMATE_EXECUTOR_DEAD,
        TEAMMATE_EXECUTOR_IDLE,
      ],
      updated_at: '2024-03-01T12:00:00.000Z',
    };
    seedRegistry(tmpDir, registry);
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should return only entries with status equal to active', async () => {
    // Act
    const result = await listActiveTeammates(tmpDir);

    // Assert
    assert.ok(Array.isArray(result), 'result must be an array');
    assert.equal(result.length, 2, 'only 2 of 4 teammates are active');
    for (const entry of result) {
      assert.equal(entry.status, 'active', `every returned entry must have status "active", got "${entry.status}"`);
    }
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes(TEAMMATE_RESEARCHER.id), 'active researcher must be included');
    assert.ok(ids.includes(TEAMMATE_PLANNER.id), 'active planner must be included');
    assert.ok(!ids.includes(TEAMMATE_EXECUTOR_DEAD.id), 'dead executor must be excluded');
    assert.ok(!ids.includes(TEAMMATE_EXECUTOR_IDLE.id), 'idle executor must be excluded');
  });
});

// ---------------------------------------------------------------------------
// Tests: updateTeammateStatus
// ---------------------------------------------------------------------------

describe('updateTeammateStatus', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  after(() => {
    rmrf(tmpDir);
  });

  it('should update only the status field and preserve all other fields on the entry', async () => {
    // Arrange — registry with one active researcher
    const initial = {
      teammates: [{ ...TEAMMATE_RESEARCHER }],
      updated_at: '2024-03-01T10:00:00.000Z',
    };
    seedRegistry(tmpDir, initial);

    // Act
    await updateTeammateStatus(tmpDir, TEAMMATE_RESEARCHER.id, 'dead');

    // Assert — status changed
    const result = loadRaw(tmpDir);
    const updated = result.teammates.find((t) => t.id === TEAMMATE_RESEARCHER.id);
    assert.ok(updated !== undefined, 'entry must still be present after status update');
    assert.equal(updated.status, 'dead', 'status field must be updated to "dead"');
    // All other fields must be preserved exactly
    assert.equal(updated.id, TEAMMATE_RESEARCHER.id);
    assert.equal(updated.role, TEAMMATE_RESEARCHER.role);
    assert.equal(updated.session_id, TEAMMATE_RESEARCHER.session_id);
    assert.equal(updated.started_at, TEAMMATE_RESEARCHER.started_at);
  });

  it('should not throw when updating status for an id that does not exist', async () => {
    // Arrange — registry with one teammate
    const initial = {
      teammates: [{ ...TEAMMATE_RESEARCHER }],
      updated_at: '2024-03-01T10:00:00.000Z',
    };
    seedRegistry(tmpDir, initial);

    // Act + Assert — must not throw for a non-existent ID
    await assert.doesNotReject(
      async () => updateTeammateStatus(tmpDir, 'non-existent-id-xyz', 'dead')
    );

    // Also verify registry was not mutated
    const result = loadRaw(tmpDir);
    assert.equal(result.teammates.length, 1, 'teammates length must be unchanged');
  });
});
