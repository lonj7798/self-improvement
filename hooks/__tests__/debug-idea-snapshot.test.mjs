/**
 * Structural regression test for debug issue #4 --
 * User ideas appended to `idea.md` between Step 5 (snapshot) and Step 7a After
 * (clear) were silently lost: the window spans Step 6 (3 parallel researchers)
 * + Step 7a (3 parallel planners) -- realistically 5-20 minutes of wall-clock
 * during which the user is explicitly invited (line 45) to append ideas.
 *
 * The fix is an atomic snapshot-rename in Step 5: rename `idea.md` into
 * `docs/agent_defined/idea_snapshots/round_{N}.md` and recreate an empty
 * `idea.md`. Any ideas appended during Steps 6-7a land in the fresh file and
 * are picked up by the NEXT iteration. Step 7a's "clear idea.md" directive
 * is no longer needed (the file is already empty post-rename) and is removed.
 *
 * This test asserts the structural markers that prove the fix is in place.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

/**
 * Extract the Step 5 section -- everything between "### Step 5" and the
 * next "### Step" heading.
 */
function extractStep5(text) {
  const startMarker = '### Step 5';
  const start = text.indexOf(startMarker);
  assert.ok(start !== -1, `Expected "${startMarker}" heading in CLAUDE.md`);
  const rest = text.slice(start + startMarker.length);
  const nextHeading = rest.match(/\n### Step /);
  const end = nextHeading !== null ? nextHeading.index : rest.length;
  return rest.slice(0, end);
}

/**
 * Extract the Step 7a section (not Step 7a½, 7b, 7c) -- everything between
 * "### Step 7a" (not followed by ½/b/c) and the next "### Step" heading.
 */
function extractStep7a(text) {
  // Match "### Step 7a —" or "### Step 7a " (space) -- exclude 7a½/7b/7c by
  // requiring an em-dash or space (not ½/b/c) immediately after.
  const re = /### Step 7a(?![½\u00BD])\s*[—\-]/;
  const match = text.match(re);
  assert.ok(match !== null, 'Expected "### Step 7a" heading in CLAUDE.md');
  const start = match.index + match[0].length;
  const rest = text.slice(start);
  const nextHeading = rest.match(/\n### Step /);
  const end = nextHeading !== null ? nextHeading.index : rest.length;
  return rest.slice(0, end);
}

describe('CLAUDE.md idea.md atomic snapshot-rename (debug #4)', () => {
  it('Step 5 uses atomic rename (mv) into idea_snapshots/', () => {
    const section = extractStep5(content);
    assert.ok(
      section.includes('mv '),
      'Expected Step 5 to reference "mv " (atomic rename) for idea.md snapshot'
    );
    assert.ok(
      section.includes('idea_snapshots'),
      'Expected Step 5 to reference "idea_snapshots" directory for the rotated snapshot file'
    );
  });

  it('Step 5 no longer contains the "do NOT clear" prose', () => {
    const section = extractStep5(content);
    assert.ok(
      !/do NOT clear/i.test(section),
      'Expected Step 5 to no longer contain "do NOT clear" prose (the rename replaces the defer-clear pattern)'
    );
  });

  it('Step 7a After block no longer contains a clear-idea.md directive', () => {
    const section = extractStep7a(content);
    // The After block is the portion starting at "**After**:" in Step 7a.
    const afterIdx = section.indexOf('**After**');
    assert.ok(
      afterIdx !== -1,
      'Expected Step 7a to contain an **After** block'
    );
    const afterBlock = section.slice(afterIdx);
    assert.ok(
      !/clear[^\n]*idea\.md/i.test(afterBlock),
      'Expected Step 7a After block to NOT contain a "clear ... idea.md" directive (rename at Step 5 already rotated the file)'
    );
  });

  it('Step 7a planner invocations reference the snapshot path', () => {
    const section = extractStep7a(content);
    const referencesSnapshotPath =
      /idea_snapshots\/round_/.test(section) ||
      /snapshot_path/.test(section);
    assert.ok(
      referencesSnapshotPath,
      'Expected Step 7a planner invocation prose to reference "idea_snapshots/round_" or "snapshot_path" so planners read the rotated snapshot rather than the live idea.md'
    );
  });
});
