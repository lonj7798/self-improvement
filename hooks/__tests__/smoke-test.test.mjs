/**
 * smoke-test.test.mjs — System assembly smoke test for v0.0.1-B infrastructure.
 *
 * @calling-spec
 * - Verifies all 7 hook scripts exist and export a default function
 * - Verifies lib modules exist and export expected functions
 * - Verifies run.cjs ROUTES maps all 7 events
 * - Verifies state files exist (teammate_registry.json, notebook.json, findings/)
 * - Verifies agent CLAUDE.md files contain v0.0.1-B markers
 * - Verifies claude/settings.json has all 7 hooks registered
 *
 * Run: node --test hooks/__tests__/smoke-test.test.mjs
 *   (from /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const HOOKS_DIR = path.join(PROJECT_ROOT, 'hooks');
const LIB_DIR = path.join(HOOKS_DIR, 'lib');
const AGENTS_DIR = path.join(PROJECT_ROOT, 'claude', 'agents');
const STATE_DIR = path.join(PROJECT_ROOT, 'docs', 'agent_defined');

const HOOK_SCRIPTS = [
  'si-loop-resume.mjs',
  'si-agent-tracker.mjs',
  'si-teammate-dispatch.mjs',
  'si-state-flush.mjs',
  'si-stop-guard.mjs',
  'si-session-end.mjs',
  'si-state-validator.mjs',
];

const HOOK_EVENTS = [
  'SessionStart',
  'SubagentStop',
  'TeammateIdle',
  'PreCompact',
  'Stop',
  'SessionEnd',
  'PostToolUse',
];

// ---------------------------------------------------------------------------

describe('smoke: all 7 hook scripts exist and export a default function', () => {
  it('each hook .mjs exports a default function', async () => {
    for (const script of HOOK_SCRIPTS) {
      const filePath = path.join(HOOKS_DIR, script);
      assert.ok(fs.existsSync(filePath), `Missing hook script: ${script}`);
      const mod = await import(filePath);
      assert.strictEqual(
        typeof mod.default,
        'function',
        `${script} default export is not a function`
      );
    }
  });
});

// ---------------------------------------------------------------------------

describe('smoke: lib modules exist and export expected functions', () => {
  it('state-io exports readJSON, writeJSON, readIterationState, writeIterationState', async () => {
    const mod = await import(path.join(LIB_DIR, 'state-io.mjs'));
    for (const fn of ['readJSON', 'writeJSON', 'readIterationState', 'writeIterationState']) {
      assert.strictEqual(typeof mod[fn], 'function', `state-io missing export: ${fn}`);
    }
  });

  it('registry-io exports readRegistry, addTeammate, removeTeammate', async () => {
    const mod = await import(path.join(LIB_DIR, 'registry-io.mjs'));
    for (const fn of ['readRegistry', 'addTeammate', 'removeTeammate']) {
      assert.strictEqual(typeof mod[fn], 'function', `registry-io missing export: ${fn}`);
    }
  });

  it('team-manager exports createTeammate, killTeammate, handoff', async () => {
    const mod = await import(path.join(LIB_DIR, 'team-manager.mjs'));
    for (const fn of ['createTeammate', 'killTeammate', 'handoff']) {
      assert.strictEqual(typeof mod[fn], 'function', `team-manager missing export: ${fn}`);
    }
  });

  it('retrospection exports detectPlateau, detectHighFailureRate, detectNearMiss', async () => {
    const mod = await import(path.join(LIB_DIR, 'retrospection.mjs'));
    for (const fn of ['detectPlateau', 'detectHighFailureRate', 'detectNearMiss']) {
      assert.strictEqual(typeof mod[fn], 'function', `retrospection missing export: ${fn}`);
    }
  });
});

// ---------------------------------------------------------------------------

describe('smoke: run.cjs ROUTES maps all 7 events', () => {
  it('ROUTES has exactly 7 entries covering all hook events', () => {
    const require = createRequire(import.meta.url);
    const { ROUTES } = require(path.join(HOOKS_DIR, 'run.cjs'));
    assert.strictEqual(
      Object.keys(ROUTES).length,
      7,
      `Expected 7 ROUTES entries, got ${Object.keys(ROUTES).length}`
    );
    for (const event of HOOK_EVENTS) {
      assert.ok(event in ROUTES, `ROUTES missing event: ${event}`);
    }
  });
});

// ---------------------------------------------------------------------------

describe('smoke: all state files exist', () => {
  it('teammate_registry.json exists', () => {
    const fp = path.join(STATE_DIR, 'teammate_registry.json');
    assert.ok(fs.existsSync(fp), `Missing: ${fp}`);
  });

  it('notebook.json exists', () => {
    const fp = path.join(STATE_DIR, 'notebook.json');
    assert.ok(fs.existsSync(fp), `Missing: ${fp}`);
  });

  it('findings/ directory exists', () => {
    const fp = path.join(STATE_DIR, 'findings');
    assert.ok(fs.existsSync(fp) && fs.statSync(fp).isDirectory(), `Missing directory: ${fp}`);
  });
});

// ---------------------------------------------------------------------------

describe('smoke: all agent CLAUDE.md files contain v0.0.1-B markers', () => {
  it('si-researcher CLAUDE.md contains "mode="', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'si-researcher', 'CLAUDE.md'), 'utf8');
    assert.ok(content.includes('mode='), 'si-researcher/CLAUDE.md missing "mode=" marker');
  });

  it('si-planner CLAUDE.md contains "role="', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'si-planner', 'CLAUDE.md'), 'utf8');
    assert.ok(content.includes('role='), 'si-planner/CLAUDE.md missing "role=" marker');
  });

  it('si-executor CLAUDE.md contains "de-risk"', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'si-executor', 'CLAUDE.md'), 'utf8');
    assert.ok(content.includes('de-risk') || content.includes('de_risk'), 'si-executor/CLAUDE.md missing de-risk marker');
  });

  it('orchestrator CLAUDE.md contains "si-team-manager"', () => {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'CLAUDE.md'), 'utf8');
    assert.ok(content.includes('si-team-manager'), 'CLAUDE.md missing "si-team-manager" marker');
  });
});

// ---------------------------------------------------------------------------

describe('smoke: claude/settings.json has all 7 hooks registered', () => {
  it('settings.json registers all 7 hook events', () => {
    const settingsPath = path.join(PROJECT_ROOT, 'claude', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const registeredEvents = Object.keys(settings.hooks ?? {});
    for (const event of HOOK_EVENTS) {
      assert.ok(
        registeredEvents.includes(event),
        `settings.json missing hook event: ${event}`
      );
    }
  });
});
