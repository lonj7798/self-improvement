/**
 * Structural tests for CLAUDE.md Step 9 -- winner handoff and findings publication (Task 8.5)
 *
 * Reads CLAUDE.md and checks for required string presence.
 * These tests FAIL before Step 9g (winner handoff) is added (RED phase).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

describe('CLAUDE.md Step 9 -- winner handoff and findings (8.5)', () => {
  it('Step 9 references /si-team-manager handoff', () => {
    assert.ok(
      content.includes('/si-team-manager handoff'),
      'Expected "/si-team-manager handoff" to appear in CLAUDE.md (winner handoff via skill)'
    );
  });

  it('Step 9 publishes findings after executor completion', () => {
    const hasFindings = content.includes('findings/');
    const hasExecutorResults =
      content.includes('executor_{id}.json') ||
      content.includes('round_{N}_executor') ||
      content.includes('round_{n}_executor');
    assert.ok(
      hasFindings,
      'Expected "findings/" to appear in CLAUDE.md (findings publication path)'
    );
    assert.ok(
      hasExecutorResults,
      'Expected executor findings path pattern to appear in CLAUDE.md'
    );
  });

  it('Step 9 updates notebook via /si-team-manager', () => {
    // The handoff section must reference notebook in context of winner feedback
    const handoffIndex = content.indexOf('/si-team-manager handoff');
    assert.ok(
      handoffIndex !== -1,
      'Expected "/si-team-manager handoff" to appear in CLAUDE.md'
    );
    // notebook must be referenced somewhere in Step 9 context (handoff manages notebook archiving)
    const step9Index = content.indexOf('Step 9 —');
    const step10Index = content.indexOf('Step 10 —');
    assert.ok(
      step9Index !== -1,
      'Expected "Step 9 —" to appear in CLAUDE.md'
    );
    assert.ok(
      step10Index !== -1,
      'Expected "Step 10 —" to appear in CLAUDE.md'
    );
    const step9Content = content.slice(step9Index, step10Index);
    assert.ok(
      step9Content.includes('notebook'),
      'Expected "notebook" to appear in Step 9 section of CLAUDE.md (handoff manages notebook lifecycle)'
    );
  });

  it('Step 9 handles no-winner case with rethink message', () => {
    assert.ok(
      content.includes('no winner') || content.includes('no-winner') || content.includes('No winner'),
      'Expected no-winner handling to appear in CLAUDE.md'
    );
    // The no-winner branch must send feedback to continuation planner
    const hasRethink =
      content.includes('Rethink') || content.includes('rethink');
    assert.ok(
      hasRethink,
      'Expected "Rethink" feedback message to appear in CLAUDE.md for no-winner case'
    );
  });
});
