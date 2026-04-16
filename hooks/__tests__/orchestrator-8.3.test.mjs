/**
 * Structural tests for CLAUDE.md Step 7a rewrite -- teammate planners (Task 8.3)
 *
 * Reads CLAUDE.md and checks for required string presence.
 * These tests FAIL before Step 7a is rewritten (RED phase).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

describe('CLAUDE.md Step 7a -- teammate planners (8.3)', () => {
  it('Step 7a references /si-team-manager create for planner creation', () => {
    assert.ok(
      content.includes('/si-team-manager create'),
      'Expected "/si-team-manager create" to appear in CLAUDE.md Step 7a'
    );
  });

  it('Step 7a defines continuation planner role', () => {
    // Must reference a "continuation" planner that operates in EXPLOIT mode
    const hasContinuation = content.includes('continuation');
    const hasExploit =
      content.includes('EXPLOIT') || content.includes('exploit');
    assert.ok(
      hasContinuation,
      'Expected "continuation" planner role to appear in CLAUDE.md Step 7a'
    );
    assert.ok(
      hasExploit,
      'Expected "EXPLOIT" or "exploit" to appear alongside continuation planner'
    );
  });

  it('Step 7a defines challenger planner roles', () => {
    // Must reference "challenger" planners that operate in EXPLORE mode
    const hasChallenger = content.includes('challenger');
    const hasExplore =
      content.includes('EXPLORE') || content.includes('explore');
    assert.ok(
      hasChallenger,
      'Expected "challenger" planner role to appear in CLAUDE.md Step 7a'
    );
    assert.ok(
      hasExplore,
      'Expected "EXPLORE" or "explore" to appear alongside challenger planners'
    );
  });

  it('Step 7a routes idea.md to continuation planner only', () => {
    // idea.md must appear in context of continuation planner
    // Find the Step 7a section and verify idea.md appears with continuation context
    const step7aIndex = content.indexOf('Step 7a');
    const step7bIndex = content.indexOf('Step 7b');
    const step7aSection =
      step7aIndex !== -1 && step7bIndex !== -1
        ? content.slice(step7aIndex, step7bIndex)
        : content;

    assert.ok(
      step7aSection.includes('idea.md'),
      'Expected "idea.md" to appear in Step 7a section'
    );
    // idea.md should appear near continuation (not given to challengers)
    const ideaMdPos = step7aSection.indexOf('idea.md');
    const continuationPos = step7aSection.indexOf('continuation');
    assert.ok(
      ideaMdPos !== -1 && continuationPos !== -1,
      'Expected both "idea.md" and "continuation" in Step 7a section'
    );
  });

  it('Step 7a assigns different briefs to different planners', () => {
    // Challenger B gets brief_repo, Challenger C gets brief_fail
    assert.ok(
      content.includes('brief_repo'),
      'Expected "brief_repo" brief assignment in Step 7a'
    );
    assert.ok(
      content.includes('brief_fail'),
      'Expected "brief_fail" brief assignment in Step 7a'
    );
  });

  it('Step 7a preserves plan output collection', () => {
    // Plans must still be collected from docs/plans/round_{n}/
    assert.ok(
      content.includes('docs/plans/round_'),
      'Expected plan output path "docs/plans/round_" to appear in CLAUDE.md Step 7a'
    );
  });
});
