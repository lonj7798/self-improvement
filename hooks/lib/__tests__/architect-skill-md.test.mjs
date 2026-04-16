/**
 * architect-skill-md.test.mjs
 * RED phase tests for Task 7.2 — Update si-plan-architect SKILL.md.
 *
 * These 3 tests validate the structural content of the si-plan-architect
 * SKILL.md file after the GREEN phase adds check 7 (simplicity assessment).
 * They read the real file on disk and assert that the required additions
 * are present.
 *
 * Expected RED-phase failure reason:
 *   Test 1 fails because the simplicity assessment section (check 7) has NOT
 *   been added yet — neither "simplicity" nor "complexity" appear as a numbered
 *   check heading in the current file.
 *   Tests 2 and 3 pass now (regression guards) — they verify that the GREEN
 *   phase does not remove existing checks or the output format.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/architect-skill-md.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Resolve the SKILL.md path.
// Path ancestry from this file:
//   __tests__/  --(..)--> lib/  --(..)--> hooks/  --(..)--> self-improvement/
// Three levels up from this file's directory reaches self-improvement/.
// The skill file lives at:
//   self-improvement/claude/agents/si-planner/skills/si-plan-architect/SKILL.md
// ---------------------------------------------------------------------------

const SELF_IMPROVEMENT_ROOT = path.resolve(
  new URL('.', import.meta.url).pathname, // .../self-improvement/hooks/lib/__tests__/
  '..', '..', '..'                        // three levels up → self-improvement/
);

const SKILL_MD_PATH = path.join(
  SELF_IMPROVEMENT_ROOT,
  'claude', 'agents', 'si-planner', 'skills', 'si-plan-architect', 'SKILL.md'
);

// ---------------------------------------------------------------------------
// Read the file once at module load. If the file is missing, the tests that
// depend on its content will fail with a clear assertion message rather than
// an uncaught exception, making the RED failure reason unambiguous.
// ---------------------------------------------------------------------------

let skillMdContent = '';
let fileExists = false;

try {
  skillMdContent = fs.readFileSync(SKILL_MD_PATH, 'utf8');
  fileExists = true;
} catch {
  fileExists = false;
}

// ---------------------------------------------------------------------------
// Test 1 — SKILL.md contains simplicity assessment check
//
// The GREEN phase adds check 7 after the existing 6 checks (~25 LOC):
//
//   ### 7. Simplicity assessment
//
//   Is this plan as simple as it could be while still testing the hypothesis?
//   ...
//   Also update the output format to include:
//     7. Simplicity: [PASS|FAIL] -- <reason>
//
// This test FAILS in the RED phase because neither "simplicity" nor
// "complexity" appears in any numbered-check context in the current file.
// The word "simplicity" does not appear at all in the 102-line current file.
// ---------------------------------------------------------------------------

describe('SKILL.md contains simplicity assessment check', () => {
  it('should contain a simplicity or complexity section as a numbered check', () => {
    // Arrange — the file must exist before its content can be validated.
    assert.ok(
      fileExists,
      `si-plan-architect SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — search for "simplicity" or "complexity" appearing in a heading
    // or numbered check context. The GREEN phase adds:
    //   "### 7. Simplicity assessment"
    // and the body text "Is this plan as simple as it could be..."
    // Accept either keyword to be robust against minor wording variations,
    // but require one of them to be present.
    const hasSimplicityCheck =
      /simplicity/i.test(skillMdContent) ||
      /complexity/i.test(skillMdContent);

    // Assert
    assert.ok(
      hasSimplicityCheck,
      'SKILL.md must contain a simplicity assessment check (check 7). ' +
      'Expected to find "simplicity" or "complexity" in a numbered check ' +
      'section added by the GREEN phase (e.g. "### 7. Simplicity assessment"). ' +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2 — SKILL.md preserves all 6 original checks
//
// The GREEN phase adds check 7 but must not remove or rename any of the
// original 6 checks. This test asserts that each original check's distinctive
// keyword is still present in the file.
//
// Original checks from current SKILL.md:
//   1. Testability      (line 22)
//   2. Novelty          (line 32)
//   3. Scope            (line 39) — "Scope appropriateness"
//   4. Target files     (line 47) — "Target files validity"
//   5. Implementation clarity (line 56)
//   6. Expected outcome (line 65) — "Expected outcome realism"
//
// This test PASSES in the RED phase (regression guard).
// ---------------------------------------------------------------------------

describe('SKILL.md preserves all 6 original checks', () => {
  it('should retain Testability, Novelty, Scope, Target files, Implementation clarity, and Expected outcome checks', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-plan-architect SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — verify each original check's distinctive keyword is still present.
    // These are the exact section headings from the current SKILL.md that the
    // GREEN phase must preserve verbatim.
    const requiredChecks = [
      { label: 'Testability',            pattern: /Testability/i },
      { label: 'Novelty',                pattern: /Novelty/i },
      { label: 'Scope',                  pattern: /Scope/i },
      { label: 'Target files',           pattern: /Target files/i },
      { label: 'Implementation clarity', pattern: /Implementation clarity/i },
      { label: 'Expected outcome',       pattern: /Expected outcome/i },
    ];

    const missingChecks = requiredChecks
      .filter(({ pattern }) => !pattern.test(skillMdContent))
      .map(({ label }) => label);

    // Assert
    assert.deepEqual(
      missingChecks,
      [],
      'SKILL.md must preserve all 6 original review checks. ' +
      `Missing checks: ${missingChecks.join(', ')}. ` +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — SKILL.md output format preserved
//
// The GREEN phase adds check 7 and a new output line for it, but must not
// remove the existing output format block. This test asserts that:
//   a) The "ARCHITECT REVIEW" header is still present.
//   b) "VERDICT" is still present (the final decision line in the format block).
//
// Both keywords appear in the current SKILL.md output format section
// (lines 78-101) and must survive the GREEN phase edit intact.
//
// This test PASSES in the RED phase (regression guard).
// ---------------------------------------------------------------------------

describe('SKILL.md output format preserved', () => {
  it('should retain the ARCHITECT REVIEW format block with VERDICT', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-plan-architect SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — check for the ARCHITECT REVIEW header and the VERDICT keyword.
    // The current output format section (lines 78-101) contains:
    //   ARCHITECT REVIEW
    //   ================
    //   ...
    //   VERDICT: [APPROVE|REJECT]
    // The GREEN phase extends this block with a "7. Simplicity: ..." line
    // but must not remove "ARCHITECT REVIEW" or "VERDICT".
    const hasArchitectReviewHeader = /ARCHITECT REVIEW/.test(skillMdContent);
    const hasVerdictLine           = /VERDICT/.test(skillMdContent);

    // Assert each keyword individually so the failure message is precise.
    assert.ok(
      hasArchitectReviewHeader,
      'SKILL.md must preserve the "ARCHITECT REVIEW" header in the output ' +
      'format section. ' +
      `File path: ${SKILL_MD_PATH}`
    );

    assert.ok(
      hasVerdictLine,
      'SKILL.md must preserve the "VERDICT" keyword in the output format ' +
      'section (e.g. "VERDICT: [APPROVE|REJECT]"). ' +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});
