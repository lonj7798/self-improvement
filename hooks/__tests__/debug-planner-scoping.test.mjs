/**
 * Structural regression test for debug issue #3 --
 * The `planner_a MUST use a user idea` rule must be scoped to bootstrap
 * rounds only, and steady-state log templates must NOT hardcode the
 * `planner_a/b/c` literals (those labels don't exist in steady state).
 *
 * Prior to the fix:
 *  - `CLAUDE.md` line 157 asserted `planner_a MUST use a user idea if one
 *    is available.` unconditionally, contradicting Step 7a's steady-state
 *    branch where `planner_a` doesn't exist and user ideas go to the
 *    continuation planner only.
 *  - `CLAUDE.md` Step 7a/7b After templates hardcoded `- planner_a:` etc.
 *    which is wrong for steady state (where labels are `continuation`,
 *    `planner_b`, `planner_c`).
 *  - `claude/agents/si-planner/CLAUDE.md` repeated the same contradiction
 *    at lines 37, 51, 81, 84.
 *
 * This test asserts the structural markers that prove the scoping fix is
 * in place in both documents.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');
const PLANNER_MD_PATH = join(
  __dirname,
  '..',
  '..',
  'claude',
  'agents',
  'si-planner',
  'CLAUDE.md'
);

const orchestratorMd = readFileSync(CLAUDE_MD_PATH, 'utf8');
const plannerMd = readFileSync(PLANNER_MD_PATH, 'utf8');

/**
 * Extract a section starting at a given heading marker up to the next
 * `### Step ` heading (or end of file).
 */
function extractSection(content, startMarker) {
  const start = content.indexOf(startMarker);
  assert.ok(
    start !== -1,
    `Expected "${startMarker}" heading to appear in document`
  );
  const rest = content.slice(start + startMarker.length);
  const nextHeadingMatch = rest.match(/\n### Step /);
  const end = nextHeadingMatch !== null ? nextHeadingMatch.index : rest.length;
  return rest.slice(0, end);
}

/**
 * Extract the steady-state branch from Step 7a. Everything between the
 * `**Steady state` marker and the end of Step 7a.
 */
function extractSteadyStateBranch(section) {
  const steadyMarker = '**Steady state';
  const idx = section.indexOf(steadyMarker);
  assert.ok(
    idx !== -1,
    'Expected "**Steady state" marker in Step 7a section'
  );
  return section.slice(idx);
}

describe('planner_a scoping and steady-state log templates (debug #3)', () => {
  it('Step 5 scopes the planner_a user-idea rule to bootstrap only', () => {
    const section = extractSection(orchestratorMd, '### Step 5 — Check for User Ideas');
    // Find the sentence that mentions `planner_a MUST`. It must include
    // both a bootstrap-scope marker AND a steady-state clarification.
    assert.ok(
      /planner_a[\s`'"*_]*\s*MUST/i.test(section),
      'Expected Step 5 to still mention the planner_a MUST rule (keep it, just scope it)'
    );
    assert.ok(
      /bootstrap/i.test(section),
      'Expected Step 5 rule to be scoped with the word "bootstrap"'
    );
    assert.ok(
      /steady[\s-]?state/i.test(section),
      'Expected Step 5 to also clarify the steady-state behavior (user ideas -> continuation planner)'
    );
  });

  it('Step 7a steady-state After log template does not hardcode planner_a', () => {
    const step7a = extractSection(orchestratorMd, '### Step 7a — Planning');
    const steady = extractSteadyStateBranch(step7a);
    // In the steady-state branch (and the After block that follows it),
    // the literal `- planner_a:` must not appear.
    const hardcodedCount = (steady.match(/- planner_a:/g) || []).length;
    assert.equal(
      hardcodedCount,
      0,
      'Expected no hardcoded "- planner_a:" lines in Step 7a steady-state / After log template'
    );
  });

  it('Step 7b After log template does not hardcode planner_a/b/c literals', () => {
    const step7b = extractSection(orchestratorMd, '### Step 7b — Critic Review');
    const hardcodedCount = (step7b.match(/- planner_a:/g) || []).length;
    assert.equal(
      hardcodedCount,
      0,
      'Expected no hardcoded "- planner_a:" lines in Step 7b critic After log template (steady state uses continuation/planner_b/planner_c)'
    );
  });

  it('Step 7a bootstrap branch still documents planner_a as a real teammate', () => {
    const step7a = extractSection(orchestratorMd, '### Step 7a — Planning');
    // The bootstrap branch should still reference planner_a as a real
    // teammate label -- this is correct and must not be regressed by the
    // fix.
    const bootstrapMarker = '**Bootstrap';
    const bootstrapIdx = step7a.indexOf(bootstrapMarker);
    assert.ok(
      bootstrapIdx !== -1,
      'Expected "**Bootstrap" marker in Step 7a'
    );
    const steadyIdx = step7a.indexOf('**Steady state');
    const bootstrapBranch =
      steadyIdx !== -1
        ? step7a.slice(bootstrapIdx, steadyIdx)
        : step7a.slice(bootstrapIdx);
    assert.ok(
      /planner_a/.test(bootstrapBranch),
      'Expected bootstrap branch to still reference planner_a (it IS a real teammate there)'
    );
  });

  it('si-planner CLAUDE.md scopes planner_a MUST rule with "bootstrap"', () => {
    // Find every line that contains "planner_a" and "MUST" -- each such
    // rule must be within a few lines of the word "bootstrap".
    const lines = plannerMd.split('\n');
    const offenders = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Only flag lines that scope a MUST rule specifically to `planner_a`
      // (not generic "you are planner_a" context). The pattern is
      // "planner_a ... MUST" on the same line.
      if (/planner_a[\s`'"*_]*[^\n]{0,120}MUST/i.test(line)) {
        // Look within a 3-line window on either side for `bootstrap`.
        const windowStart = Math.max(0, i - 3);
        const windowEnd = Math.min(lines.length, i + 4);
        const window = lines.slice(windowStart, windowEnd).join('\n');
        if (!/bootstrap/i.test(window)) {
          offenders.push({ lineNumber: i + 1, text: line });
        }
      }
    }
    assert.equal(
      offenders.length,
      0,
      `Expected every "planner_a ... MUST" rule in si-planner/CLAUDE.md to be scoped to bootstrap. Offenders:\n${offenders
        .map((o) => `  line ${o.lineNumber}: ${o.text}`)
        .join('\n')}`
    );
  });

  it('si-planner CLAUDE.md scopes continuation-planner user-idea rule to steady state', () => {
    // The continuation planner section's user-idea MUST rule should be
    // within a few lines of the phrase "steady state".
    const contHeaderIdx = plannerMd.indexOf('### Continuation Planner');
    assert.ok(
      contHeaderIdx !== -1,
      'Expected "### Continuation Planner" heading in si-planner/CLAUDE.md'
    );
    // Bound: until next ### heading.
    const rest = plannerMd.slice(contHeaderIdx);
    const nextHeading = rest.slice(3).search(/\n### /);
    const contSection =
      nextHeading !== -1 ? rest.slice(0, nextHeading + 3) : rest;

    // Find the user-idea MUST sentence inside the continuation section.
    const userIdeaLineMatch = contSection.match(
      /[^\n]*user[\s-]?idea[^\n]*MUST[^\n]*/i
    );
    assert.ok(
      userIdeaLineMatch !== null,
      'Expected continuation planner section to contain a user-idea MUST sentence'
    );
    // Sentence (or its immediate surrounding bullet) must include the
    // phrase "steady state".
    const sentenceIdx = contSection.indexOf(userIdeaLineMatch[0]);
    const windowStart = Math.max(0, sentenceIdx - 200);
    const windowEnd = Math.min(contSection.length, sentenceIdx + 400);
    const window = contSection.slice(windowStart, windowEnd);
    assert.ok(
      /steady[\s-]?state/i.test(window),
      'Expected continuation planner user-idea rule to be scoped with the phrase "steady state"'
    );
  });
});
