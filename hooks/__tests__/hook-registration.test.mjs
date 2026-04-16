/**
 * hook-registration.test.mjs
 * RED phase tests for Task 2.5: Register hooks in claude/settings.json
 *
 * Both tests FAIL until the hooks section in claude/settings.json is
 * extended with all 7 required hook events.
 *
 * Run: node --test hooks/__tests__/hook-registration.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Project root is self-improvement/ -- two levels up from hooks/__tests__/
 */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Path to the settings file under test.
 * The hooks section lives in claude/settings.json (relative to PROJECT_ROOT).
 */
const SETTINGS_PATH = path.join(PROJECT_ROOT, 'claude', 'settings.json');

/**
 * The 7 hook events that must be registered per the Phase 2 spec.
 */
const REQUIRED_EVENTS = [
  'SessionStart',
  'SubagentStop',
  'TeammateIdle',
  'PreCompact',
  'Stop',
  'PostToolUse',
  'SessionEnd',
];

// ---------------------------------------------------------------------------
// Test 1: claude/settings.json contains hooks section with all 7 events
// ---------------------------------------------------------------------------

describe('claude/settings.json hooks registration', () => {
  it('should contain hooks section with all 7 events registered', () => {
    // Arrange -- read the settings file from disk
    assert.ok(
      fs.existsSync(SETTINGS_PATH),
      `claude/settings.json must exist at: ${SETTINGS_PATH}`
    );
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    let settings;
    try {
      settings = JSON.parse(raw);
    } catch (err) {
      assert.fail(`claude/settings.json must be valid JSON -- parse error: ${err.message}`);
    }

    // Act -- extract the hooks object
    const hooks = settings.hooks;

    // Assert -- hooks section exists
    assert.ok(
      hooks !== undefined && hooks !== null && typeof hooks === 'object',
      'claude/settings.json must have a top-level "hooks" object'
    );

    // Assert -- all 7 required events are present as keys in the hooks object
    const missingEvents = REQUIRED_EVENTS.filter((event) => !(event in hooks));
    assert.equal(
      missingEvents.length,
      0,
      `hooks object is missing the following required events: [${missingEvents.join(', ')}]. ` +
        `Found: [${Object.keys(hooks).join(', ')}]`
    );

    // Assert -- each event entry contains at least one hook object with type=command
    // and a command string that references run.cjs
    for (const event of REQUIRED_EVENTS) {
      const entries = hooks[event];
      assert.ok(
        Array.isArray(entries) && entries.length > 0,
        `hooks["${event}"] must be a non-empty array`
      );

      // Each entry in the outer array is a matcher group; its nested "hooks" array
      // holds the actual hook objects.
      const allHookObjects = entries.flatMap((entry) => {
        if (Array.isArray(entry.hooks)) return entry.hooks;
        // If the entry itself looks like a hook object (has type), include it directly
        if (entry.type) return [entry];
        return [];
      });

      assert.ok(
        allHookObjects.length > 0,
        `hooks["${event}"] must contain at least one hook object (with "type" and "command")`
      );

      // At least one hook object per event must reference run.cjs
      const runsRunCjs = allHookObjects.some(
        (hookObj) =>
          typeof hookObj.command === 'string' && hookObj.command.includes('run.cjs')
      );
      assert.ok(
        runsRunCjs,
        `hooks["${event}"] must include at least one hook command referencing "run.cjs". ` +
          `Got commands: [${allHookObjects.map((h) => h.command).join(', ')}]`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: all hook command scripts reference existing run.cjs path
// ---------------------------------------------------------------------------

describe('hook command run.cjs path', () => {
  it('should reference a run.cjs file that exists on disk', () => {
    // Arrange -- read and parse the settings file
    assert.ok(
      fs.existsSync(SETTINGS_PATH),
      `claude/settings.json must exist at: ${SETTINGS_PATH}`
    );
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    let settings;
    try {
      settings = JSON.parse(raw);
    } catch (err) {
      assert.fail(`claude/settings.json must be valid JSON -- parse error: ${err.message}`);
    }

    const hooks = settings.hooks;
    assert.ok(
      hooks !== undefined && hooks !== null && typeof hooks === 'object',
      'claude/settings.json must have a top-level "hooks" object before run.cjs path can be verified'
    );

    // Assert -- all 7 required events must exist so we can extract their commands
    const missingEvents = REQUIRED_EVENTS.filter((event) => !(event in hooks));
    assert.equal(
      missingEvents.length,
      0,
      `Cannot verify run.cjs path -- hooks object is missing events: [${missingEvents.join(', ')}]`
    );

    // Act -- collect every command string that contains run.cjs across all 7 events
    const runCjsCommands = [];
    for (const event of REQUIRED_EVENTS) {
      const entries = hooks[event] ?? [];
      const allHookObjects = entries.flatMap((entry) => {
        if (Array.isArray(entry.hooks)) return entry.hooks;
        if (entry.type) return [entry];
        return [];
      });
      for (const hookObj of allHookObjects) {
        if (typeof hookObj.command === 'string' && hookObj.command.includes('run.cjs')) {
          runCjsCommands.push({ event, command: hookObj.command });
        }
      }
    }

    assert.ok(
      runCjsCommands.length > 0,
      'No hook commands reference run.cjs -- at least one must exist per event'
    );

    // Assert -- extract the run.cjs path token from each command and verify the file exists.
    // Commands are of the form: "node hooks/run.cjs <EventName>"
    // The path is relative to PROJECT_ROOT (the self-improvement/ directory, which is
    // the cwd when Claude Code runs the hook command).
    for (const { event, command } of runCjsCommands) {
      // Find the token that ends with run.cjs (handles both "hooks/run.cjs" and
      // absolute paths that might appear in future variations)
      const tokens = command.split(/\s+/);
      const runCjsToken = tokens.find((t) => t.endsWith('run.cjs'));
      assert.ok(
        runCjsToken !== undefined,
        `hooks["${event}"] command "${command}" contains "run.cjs" but no token ending in run.cjs was found`
      );

      // Resolve relative to PROJECT_ROOT (cwd for hook commands)
      const resolvedPath = path.isAbsolute(runCjsToken)
        ? runCjsToken
        : path.resolve(PROJECT_ROOT, runCjsToken);

      // Assert -- the file must actually exist on disk
      assert.ok(
        fs.existsSync(resolvedPath),
        `hooks["${event}"] command references "${runCjsToken}" which resolves to ` +
          `"${resolvedPath}" -- file does not exist on disk`
      );
    }
  });
});
