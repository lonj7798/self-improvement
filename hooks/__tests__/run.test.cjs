/**
 * run.test.cjs
 * RED phase tests for self-improvement/hooks/run.cjs
 * All 9 tests must FAIL until the implementation file is created.
 *
 * Run: node --test hooks/__tests__/run.test.cjs
 * (from the self-improvement/ directory)
 *
 * Testing strategy:
 *   run.cjs exposes two testable exports:
 *     - ROUTES: a plain object mapping event name -> .mjs filename (static lookup table)
 *     - dispatch(eventName, payload, projectRoot): async function that loads the handler,
 *       calls its default export, and returns the result. Returns undefined for unknown
 *       events. Catches handler errors and logs them to stderr without re-throwing.
 *
 *   The 7 ROUTES tests verify the static mapping table.
 *   The 2 dispatch tests verify unknown-event and error-handling runtime behavior.
 *   All 9 tests fail with MODULE_NOT_FOUND until run.cjs is created.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Import the module that does NOT exist yet -- this is the RED phase.
// Every test will fail at require() time with MODULE_NOT_FOUND.
// ---------------------------------------------------------------------------
const { ROUTES, dispatch } = require('../run.cjs');

// ---------------------------------------------------------------------------
// Tests: ROUTES -- static event-to-file mapping
// ---------------------------------------------------------------------------

describe('ROUTES', () => {
  it('should map SessionStart to si-loop-resume.mjs', () => {
    // Arrange
    const eventName = 'SessionStart';
    const expectedFile = 'si-loop-resume.mjs';

    // Act
    const result = ROUTES[eventName];

    // Assert
    assert.ok(result !== undefined, `ROUTES must contain an entry for "${eventName}"`);
    assert.equal(
      path.basename(result),
      expectedFile,
      `SessionStart must route to ${expectedFile}, got: ${result}`
    );
  });

  it('should map SubagentStop to si-agent-tracker.mjs', () => {
    // Arrange
    const eventName = 'SubagentStop';
    const expectedFile = 'si-agent-tracker.mjs';

    // Act
    const result = ROUTES[eventName];

    // Assert
    assert.ok(result !== undefined, `ROUTES must contain an entry for "${eventName}"`);
    assert.equal(
      path.basename(result),
      expectedFile,
      `SubagentStop must route to ${expectedFile}, got: ${result}`
    );
  });

  it('should map TeammateIdle to si-teammate-dispatch.mjs', () => {
    // Arrange
    const eventName = 'TeammateIdle';
    const expectedFile = 'si-teammate-dispatch.mjs';

    // Act
    const result = ROUTES[eventName];

    // Assert
    assert.ok(result !== undefined, `ROUTES must contain an entry for "${eventName}"`);
    assert.equal(
      path.basename(result),
      expectedFile,
      `TeammateIdle must route to ${expectedFile}, got: ${result}`
    );
  });

  it('should map PreCompact to si-state-flush.mjs', () => {
    // Arrange
    const eventName = 'PreCompact';
    const expectedFile = 'si-state-flush.mjs';

    // Act
    const result = ROUTES[eventName];

    // Assert
    assert.ok(result !== undefined, `ROUTES must contain an entry for "${eventName}"`);
    assert.equal(
      path.basename(result),
      expectedFile,
      `PreCompact must route to ${expectedFile}, got: ${result}`
    );
  });

  it('should map Stop to si-stop-guard.mjs', () => {
    // Arrange
    const eventName = 'Stop';
    const expectedFile = 'si-stop-guard.mjs';

    // Act
    const result = ROUTES[eventName];

    // Assert
    assert.ok(result !== undefined, `ROUTES must contain an entry for "${eventName}"`);
    assert.equal(
      path.basename(result),
      expectedFile,
      `Stop must route to ${expectedFile}, got: ${result}`
    );
  });

  it('should map SessionEnd to si-session-end.mjs', () => {
    // Arrange
    const eventName = 'SessionEnd';
    const expectedFile = 'si-session-end.mjs';

    // Act
    const result = ROUTES[eventName];

    // Assert
    assert.ok(result !== undefined, `ROUTES must contain an entry for "${eventName}"`);
    assert.equal(
      path.basename(result),
      expectedFile,
      `SessionEnd must route to ${expectedFile}, got: ${result}`
    );
  });

  it('should map PostToolUse to si-state-validator.mjs', () => {
    // Arrange
    const eventName = 'PostToolUse';
    const expectedFile = 'si-state-validator.mjs';

    // Act
    const result = ROUTES[eventName];

    // Assert
    assert.ok(result !== undefined, `ROUTES must contain an entry for "${eventName}"`);
    assert.equal(
      path.basename(result),
      expectedFile,
      `PostToolUse must route to ${expectedFile}, got: ${result}`
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: dispatch -- runtime behavior
// ---------------------------------------------------------------------------

describe('dispatch', () => {
  it('should return undefined and not throw when event name is unknown', async () => {
    // Arrange
    // Precondition: ROUTES must be a populated table with all 7 known events.
    // This ensures the test is exercising the real implementation, not a no-op stub.
    // A correct implementation maps exactly the 7 specified hook events.
    const EXPECTED_ROUTE_COUNT = 7;
    assert.equal(
      Object.keys(ROUTES).length,
      EXPECTED_ROUTE_COUNT,
      `ROUTES must have exactly ${EXPECTED_ROUTE_COUNT} entries -- run.cjs is not fully implemented`
    );

    const unknownEvent = 'UnknownEventThatDoesNotExist';
    const payload = { hook: unknownEvent };
    const projectRoot = '/tmp/fake-project-root';

    // Act
    const result = await dispatch(unknownEvent, payload, projectRoot);

    // Assert
    assert.equal(result, undefined, 'dispatch must return undefined for unknown events');
  });

  it('should catch handler errors and log to stderr without throwing', async () => {
    // Arrange
    // Capture stderr output to verify the error is logged.
    const stderrChunks = [];
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk, ...args) => {
      stderrChunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return originalStderrWrite(chunk, ...args);
    };

    // Temporarily point a route to a non-existent file so import() throws
    // ERR_MODULE_NOT_FOUND. dispatch() must catch that error, write it to
    // stderr, and NOT re-throw it.
    const originalRoute = ROUTES.SessionStart;
    ROUTES.SessionStart = path.join(__dirname, '..', 'non-existent-handler.mjs');
    const eventName = 'SessionStart';
    const payload = { hook: eventName };
    const projectRoot = '/tmp/fake-project-root-for-error-test';

    let threwError = false;

    try {
      // Act
      await dispatch(eventName, payload, projectRoot);
    } catch (err) {
      threwError = true;
    } finally {
      // Restore stderr and route unconditionally
      process.stderr.write = originalStderrWrite;
      ROUTES.SessionStart = originalRoute;
    }

    // Assert -- dispatch must absorb the error rather than propagate it
    assert.equal(threwError, false, 'dispatch must not throw even when the handler fails to load');
    // dispatch must log the error to stderr so failures are visible
    const stderrOutput = stderrChunks.join('');
    assert.ok(
      stderrOutput.length > 0,
      'dispatch must write an error message to stderr when handler import or execution fails'
    );
  });
});
