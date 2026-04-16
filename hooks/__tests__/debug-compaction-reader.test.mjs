/**
 * Structural regression test for debug issue #1 --
 * The PreCompact hook (si-state-flush.mjs) writes
 * iteration_state.compaction_pending = true whenever a continuation planner
 * is active, but no orchestrator or sub-agent documentation currently reads
 * that flag. As a result, the continuation planner's in-memory notebook
 * context is lost on compaction and never flushed back to notebook.json,
 * leaving it stale for the next round.
 *
 * The fix wires the reader in three places:
 *   1. self-improvement/CLAUDE.md                         -- orchestrator consumes flag and dispatches flush-notebook
 *   2. self-improvement/claude/skills/si-team-manager/SKILL.md   -- new flush-notebook command
 *   3. self-improvement/claude/agents/si-planner/CLAUDE.md -- continuation planner responds to flush_notebook
 *
 * These tests verify the structural markers that prove the reader is wired in.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const ORCHESTRATOR_CLAUDE_MD = join(PROJECT_ROOT, 'CLAUDE.md');
const PLANNER_CLAUDE_MD = join(
  PROJECT_ROOT,
  'claude',
  'agents',
  'si-planner',
  'CLAUDE.md'
);
const TEAM_MANAGER_SKILL_MD = join(
  PROJECT_ROOT,
  'claude',
  'skills',
  'si-team-manager',
  'SKILL.md'
);

const orchestratorMd = readFileSync(ORCHESTRATOR_CLAUDE_MD, 'utf8');
const plannerMd = readFileSync(PLANNER_CLAUDE_MD, 'utf8');

describe('Compaction flag is consumed by orchestrator (debug #1)', () => {
  it('orchestrator CLAUDE.md references compaction_pending in at least two places (read + clear)', () => {
    // The orchestrator must both check the flag AND clear it, so
    // compaction_pending should appear at least twice in the document.
    const matches = orchestratorMd.match(/compaction_pending/g) ?? [];
    assert.ok(
      matches.length >= 2,
      `Expected "compaction_pending" to appear at least twice in orchestrator CLAUDE.md (read context + clear context); found ${matches.length}`
    );
  });

  it('orchestrator CLAUDE.md mentions flush-notebook (or flush_notebook) directive', () => {
    const hasFlushDirective =
      /flush-notebook|flush_notebook/.test(orchestratorMd);
    assert.ok(
      hasFlushDirective,
      'Expected orchestrator CLAUDE.md to mention the "flush-notebook" command or "flush_notebook" directive used to recover from compaction'
    );
  });
});

describe('si-team-manager SKILL.md documents flush-notebook command (debug #1)', () => {
  it('SKILL.md exists at claude/skills/si-team-manager/SKILL.md', () => {
    assert.ok(
      existsSync(TEAM_MANAGER_SKILL_MD),
      `Expected si-team-manager SKILL.md at: ${TEAM_MANAGER_SKILL_MD}`
    );
  });

  it('SKILL.md documents the flush-notebook action', () => {
    assert.ok(
      existsSync(TEAM_MANAGER_SKILL_MD),
      `Expected si-team-manager SKILL.md at: ${TEAM_MANAGER_SKILL_MD}`
    );
    const skillMd = readFileSync(TEAM_MANAGER_SKILL_MD, 'utf8');
    assert.ok(
      /flush-notebook/.test(skillMd),
      'Expected si-team-manager SKILL.md to document the "flush-notebook" command alongside create/kill/handoff/list/notebook'
    );
  });
});

describe('si-planner CLAUDE.md documents flush_notebook response handling (debug #1)', () => {
  it('planner CLAUDE.md references flush_notebook in a response/handling context', () => {
    assert.ok(
      /flush_notebook/.test(plannerMd),
      'Expected si-planner CLAUDE.md to document how the continuation planner handles "flush_notebook" directives (write accumulated state to notebook.json, reply with ack)'
    );
  });
});
