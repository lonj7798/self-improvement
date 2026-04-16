/**
 * critic-skill-md.test.mjs
 * RED phase tests for Task 7.1 — Update si-plan-critic SKILL.md.
 *
 * These 6 tests validate the structural content of the si-plan-critic SKILL.md
 * file after the GREEN phase adds H004 (simplicity criterion) and H005 (hybrid
 * redundancy check) sections, and extends the critic_review output schema.
 * They read the real file on disk and assert that the required additions are
 * present.
 *
 * Expected RED-phase failure reason:
 *   Tests 1-4 and 6 fail because H004, H005, source_plans, h004_simplicity,
 *   and h005_hybrid_redundancy do not appear anywhere in the current SKILL.md.
 *   Test 5 passes in the RED phase (regression guard) — H001, H002, and H003
 *   are already present and must survive the GREEN phase edit unchanged.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/critic-skill-md.test.mjs
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
//   self-improvement/claude/agents/si-planner/skills/si-plan-critic/SKILL.md
// ---------------------------------------------------------------------------

const SELF_IMPROVEMENT_ROOT = path.resolve(
  new URL('.', import.meta.url).pathname, // .../self-improvement/hooks/lib/__tests__/
  '..', '..', '..'                        // three levels up → self-improvement/
);

const SKILL_MD_PATH = path.join(
  SELF_IMPROVEMENT_ROOT,
  'claude', 'agents', 'si-planner', 'skills', 'si-plan-critic', 'SKILL.md'
);

// ---------------------------------------------------------------------------
// Read the file once at module load. If the file is missing the tests that
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
// Test 1 — SKILL.md contains H004 simplicity section
//
// The GREEN phase adds an "H004" heading (with the word "simplicity") after
// the existing H003 section. The heading may be written as:
//   ### H004 -- Simplicity criterion (WARNING, not auto-reject)
// or any variation that includes both "H004" and "simplicity" in proximity.
// We accept either the bare token "H004" or "simplicity" as a section-level
// marker — because the plan requires both to be present, we check that at
// least one of the two distinct identifiers exists as a heading or label.
//
// Precise contract from plan: the section must exist with the label "H004"
// AND the word "simplicity" must appear in that same section context.
// We implement this as: the file contains "H004" AND "simplicity" anywhere
// (since H004 only appears in this new section and nowhere else in the file).
// ---------------------------------------------------------------------------

describe('SKILL.md contains H004 simplicity section', () => {
  it('should contain H004 section header with simplicity label', () => {
    // Arrange — the file must exist before its content can be validated.
    assert.ok(
      fileExists,
      `si-plan-critic SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — search for "H004" as a section identifier. The GREEN phase adds
    // the heading "### H004 -- Simplicity criterion (WARNING, not auto-reject)".
    // "H004" is confirmed absent from the current SKILL.md (0 matches in grep),
    // so this check has no false-positive risk.
    const hasH004Token = /\bH004\b/.test(skillMdContent);

    // Act — also search for "simplicity" as a section-level label.
    // "simplicity" is confirmed absent from the current file.
    const hasSimplicityLabel = /simplicity/i.test(skillMdContent);

    // Assert — both the rule identifier and the subject label must be present.
    assert.ok(
      hasH004Token,
      'SKILL.md must contain "H004" as a section identifier for the simplicity ' +
      'criterion added by the GREEN phase. ' +
      `File path: ${SKILL_MD_PATH}`
    );

    assert.ok(
      hasSimplicityLabel,
      'SKILL.md must contain "simplicity" as the subject label of the H004 section. ' +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2 — SKILL.md H004 is WARNING not auto-reject
//
// The plan explicitly specifies that H004 must be a WARNING, not an automatic
// rejection. The GREEN phase documents this constraint in the H004 section
// using the word "warn" or "WARNING" and must NOT use "reject" as the
// consequence of the H004 check.
//
// Contract from plan:
//   "This is a WARNING, not an automatic rejection."
//   "set h004_simplicity to 'warn'"
// We check for warn/WARNING presence. We do NOT check for absence of "reject"
// because "reject" legitimately appears many times in H001-H003. Instead we
// verify the affirmative positive that "warn" or "WARNING" appears in the
// H004 context (anywhere in the file is sufficient, since "warn" does not
// currently appear in the file at all).
// ---------------------------------------------------------------------------

describe('SKILL.md H004 is WARNING not auto-reject', () => {
  it('should contain warn or WARNING in H004 context signalling advisory-only enforcement', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-plan-critic SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — search for "warn" or "WARNING" anywhere in the file.
    // Confirmed absent from the current SKILL.md. The GREEN phase adds:
    //   "This is a WARNING, not an automatic rejection."
    //   "set h004_simplicity to 'warn'"
    // Either the uppercase form "WARNING" or the lowercase output value "warn"
    // satisfies this requirement.
    const hasWarnLanguage = /\bwarn\b/i.test(skillMdContent);

    // Assert
    assert.ok(
      hasWarnLanguage,
      'SKILL.md must contain "warn" or "WARNING" in the H004 section to document ' +
      'that the simplicity criterion is advisory (warning only, not auto-reject). ' +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — SKILL.md contains H005 hybrid redundancy section
//
// The GREEN phase adds an "H005" section documenting the hybrid plan
// redundancy check. The heading is expected to contain both "H005" and
// "hybrid" to make the section purpose unambiguous.
//
// Contract from plan:
//   "### H005 -- Hybrid plan redundancy check (hybrid plans only)"
// ---------------------------------------------------------------------------

describe('SKILL.md contains H005 hybrid redundancy section', () => {
  it('should contain H005 section header with hybrid label', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-plan-critic SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — search for "H005" as a section identifier.
    // Confirmed absent from the current SKILL.md.
    const hasH005Token = /\bH005\b/.test(skillMdContent);

    // Act — search for "hybrid" as the section subject.
    // Confirmed absent from the current SKILL.md.
    const hasHybridLabel = /hybrid/i.test(skillMdContent);

    // Assert — both identifiers must be present.
    assert.ok(
      hasH005Token,
      'SKILL.md must contain "H005" as a section identifier for the hybrid ' +
      'redundancy check added by the GREEN phase. ' +
      `File path: ${SKILL_MD_PATH}`
    );

    assert.ok(
      hasHybridLabel,
      'SKILL.md must contain "hybrid" as the subject label of the H005 section. ' +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4 — SKILL.md H005 checks source_plans field
//
// The H005 section must instruct the critic to read
// hybrid_metadata.source_plans. This is the specific field the critic uses
// to identify the source plans for comparison in the redundancy check.
//
// Contract from plan:
//   "Read the source plans referenced in hybrid_metadata.source_plans"
//   "Also verify: hybrid_metadata.source_plans is non-empty"
// ---------------------------------------------------------------------------

describe('SKILL.md H005 checks source_plans field', () => {
  it('should reference source_plans field in the H005 section', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-plan-critic SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — search for "source_plans" anywhere in the file.
    // Confirmed absent from the current SKILL.md.
    // The GREEN phase adds: "hybrid_metadata.source_plans" references in H005.
    const hasSourcePlans = /source_plans/.test(skillMdContent);

    // Assert
    assert.ok(
      hasSourcePlans,
      'SKILL.md must contain "source_plans" in the H005 section documenting ' +
      'that the critic reads hybrid_metadata.source_plans to perform the ' +
      'redundancy check. ' +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5 — SKILL.md preserves existing H001-H003 sections  [REGRESSION GUARD]
//
// This test PASSES in the RED phase. H001, H002, and H003 section headings
// are present in the current SKILL.md and must survive the GREEN phase edit
// unchanged. All three must be detectable as distinct heading tokens.
//
// Current SKILL.md headings confirmed by grep:
//   "### H001 — Exactly one hypothesis"      (line 32)
//   "### H002 — No approach_family repetition streak"  (line 42)
//   "### H003 — Intra-round diversity"        (line 52)
// ---------------------------------------------------------------------------

describe('SKILL.md preserves existing H001-H003 sections', () => {
  it('should retain H001, H002, and H003 section headings after GREEN phase edits', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-plan-critic SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — verify each rule identifier appears as a standalone token.
    const missingRules = ['H001', 'H002', 'H003'].filter(
      (rule) => !new RegExp(`\\b${rule}\\b`).test(skillMdContent)
    );

    // Assert — all three must be present (regression guard).
    assert.deepEqual(
      missingRules,
      [],
      'SKILL.md must preserve all original H001, H002, and H003 section headings. ' +
      `Missing rule identifiers: ${missingRules.join(', ')}. ` +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6 — SKILL.md output schema includes h004 and h005 fields
//
// The GREEN phase extends the critic_review output schema with two new fields:
//   "h004_simplicity": "pass|warn"
//   "h005_hybrid_redundancy": "pass|fail|n/a"
//
// Both field names must appear in the Output section. The existing schema
// already contains h001_hypothesis_count, h002_family_streak, and
// h003_intra_round_diversity — those are confirmed present (regression side).
// The new fields h004_simplicity and h005_hybrid_redundancy are confirmed
// absent (failing side).
// ---------------------------------------------------------------------------

describe('SKILL.md output schema includes h004 and h005 fields', () => {
  it('should contain h004_simplicity and h005_hybrid_redundancy in the critic_review schema', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-plan-critic SKILL.md must exist at: ${SKILL_MD_PATH}`
    );

    // Act — search for "h004_simplicity" in the output schema.
    // Confirmed absent from the current SKILL.md.
    const hasH004Field = /h004_simplicity/.test(skillMdContent);

    // Act — search for "h005_hybrid_redundancy" in the output schema.
    // Confirmed absent from the current SKILL.md.
    const hasH005Field = /h005_hybrid_redundancy/.test(skillMdContent);

    // Assert — both new schema fields must be present.
    assert.ok(
      hasH004Field,
      'SKILL.md critic_review schema must contain the "h004_simplicity" field ' +
      '(value: "pass|warn") added by the GREEN phase. ' +
      `File path: ${SKILL_MD_PATH}`
    );

    assert.ok(
      hasH005Field,
      'SKILL.md critic_review schema must contain the "h005_hybrid_redundancy" field ' +
      '(value: "pass|fail|n/a") added by the GREEN phase. ' +
      `File path: ${SKILL_MD_PATH}`
    );
  });
});
