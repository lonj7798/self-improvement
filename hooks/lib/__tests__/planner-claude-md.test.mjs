/**
 * planner-claude-md.test.mjs
 * RED phase tests for Task 6.1 — Update si-planner CLAUDE.md.
 *
 * These 8 tests validate the structural content of the si-planner CLAUDE.md
 * file after the GREEN phase adds continuation/challenger roles, notebook
 * protocol, and exploit/explore strategies. They read the real file on disk
 * and assert that the required additions are present.
 *
 * Expected RED-phase failure reason for every test:
 *   The role parameter, continuation planner section, challenger planner
 *   section, and notebook protocol have NOT been added yet. Tests 1-6 fail
 *   because the content they search for is absent from the current file.
 *   Tests 7-8 pass now (regression guards) but are included to verify
 *   the GREEN phase does not remove existing content.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/planner-claude-md.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Resolve the CLAUDE.md path.
// Path ancestry from this file:
//   __tests__/  --(..)--> lib/  --(..)--> hooks/  --(..)--> self-improvement/
// Three levels up from this file's directory reaches self-improvement/.
// The agent file lives at self-improvement/claude/agents/si-planner/CLAUDE.md.
// ---------------------------------------------------------------------------

const SELF_IMPROVEMENT_ROOT = path.resolve(
  new URL('.', import.meta.url).pathname, // .../self-improvement/hooks/lib/__tests__/
  '..', '..', '..'                        // three levels up → self-improvement/
);

const CLAUDE_MD_PATH = path.join(
  SELF_IMPROVEMENT_ROOT,
  'claude', 'agents', 'si-planner', 'CLAUDE.md'
);

// ---------------------------------------------------------------------------
// Read the file once at module load. If the file is missing the tests that
// depend on its content will fail with a clear assertion message rather than
// an uncaught exception, making the RED failure reason unambiguous.
// ---------------------------------------------------------------------------

let claudeMdContent = '';
let fileExists = false;

try {
  claudeMdContent = fs.readFileSync(CLAUDE_MD_PATH, 'utf8');
  fileExists = true;
} catch {
  fileExists = false;
}

// ---------------------------------------------------------------------------
// Test 1 — CLAUDE.md contains role parameter in input contract
//
// The GREEN phase adds a role parameter to the Input Contract section:
//   role=<continuation|challenger>
// The parameter may appear as role=<planner_cont|...> or role=<continuation|...>
// but "role=" must be present in the arguments block.
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains role parameter in input contract', () => {
  it('should contain role= parameter in the arguments/input contract section', () => {
    // Arrange — the file must exist before its content can be validated.
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for the role parameter pattern anywhere in the input contract.
    // The GREEN phase adds: role=<continuation|challenger>
    // Accept the bare key "role=" to be flexible across minor wording differences.
    const hasRoleParameter = /\brole=/.test(claudeMdContent);

    // Assert
    assert.ok(
      hasRoleParameter,
      'CLAUDE.md must contain "role=" in the input contract section ' +
      '(e.g. "role=<continuation|challenger>"). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2 — CLAUDE.md contains continuation planner section
//
// The GREEN phase adds a "Role-Based Behavior" section with a subsection for
// the continuation planner that documents the EXPLOIT strategy and notebook
// read/write protocol.
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains continuation planner section', () => {
  it('should contain a section describing continuation planner behavior', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for "Continuation Planner" as a heading or label.
    // The plan specifies: "### Continuation Planner (role=continuation)"
    // Accept any capitalisation of "Continuation Planner" to be robust
    // against minor wording variations.
    const hasContinuationSection = /continuation planner/i.test(claudeMdContent);

    // Assert
    assert.ok(
      hasContinuationSection,
      'CLAUDE.md must contain a "Continuation Planner" section describing the ' +
      'EXPLOIT strategy and notebook read/write protocol. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — CLAUDE.md contains challenger planner section
//
// The GREEN phase adds a subsection for the challenger planner that documents
// the EXPLORE strategy and brief-driven idea picking.
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains challenger planner section', () => {
  it('should contain a section describing challenger planner behavior', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for "Challenger Planner" as a heading or label.
    // The plan specifies: "### Challenger Planner (role=challenger)"
    const hasChallengerSection = /challenger planner/i.test(claudeMdContent);

    // Assert
    assert.ok(
      hasChallengerSection,
      'CLAUDE.md must contain a "Challenger Planner" section describing the ' +
      'EXPLORE strategy and research-brief-driven idea picking. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4 — CLAUDE.md references notebook.json
//
// The continuation planner reads and writes notebook.json. The GREEN phase
// must document this protocol — including reading at the start, adding an
// observation entry, updating current_theory, and writing back.
// ---------------------------------------------------------------------------

describe('CLAUDE.md references notebook.json', () => {
  it('should contain notebook.json in the documented protocol', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for "notebook.json" anywhere in the file.
    // The GREEN phase adds notebook read/write protocol for the continuation
    // planner: Read existing notebook.json, update it after plan creation.
    const hasNotebookReference = /notebook\.json/.test(claudeMdContent);

    // Assert
    assert.ok(
      hasNotebookReference,
      'CLAUDE.md must contain "notebook.json" documenting the notebook ' +
      'read/write protocol for the continuation planner. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5 — CLAUDE.md contains exploit strategy
//
// The continuation planner section must describe the EXPLOIT strategy using
// "exploit" keyword or the phrase "deepen what is working" / "deepen what's
// working" per the plan spec.
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains exploit strategy', () => {
  it('should contain exploit strategy language for the continuation planner', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for uppercase EXPLOIT or the exact phrase "deepen what".
    // The GREEN phase adds: "You are the EXPLOIT lane." and
    // "deepen what is working" to the continuation planner section.
    // Using uppercase-only EXPLOIT ensures no false positive from the
    // current file (confirmed absent). "deepen what" is also absent now.
    const hasExploitStrategy =
      /\bEXPLOIT\b/.test(claudeMdContent) ||
      /deepen what/i.test(claudeMdContent);

    // Assert
    assert.ok(
      hasExploitStrategy,
      'CLAUDE.md must contain exploit strategy language for the continuation ' +
      'planner (e.g. "EXPLOIT lane" or "deepen what is working"). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6 — CLAUDE.md contains explore strategy
//
// The challenger planner section must describe the EXPLORE strategy using
// "explore" keyword or "novel approach" language per the plan spec.
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains explore strategy', () => {
  it('should contain explore strategy language for the challenger planner', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for uppercase EXPLORE as specified in the plan.
    // The GREEN phase adds: "You are the EXPLORE lane." to the challenger
    // planner section. Uppercase-only EXPLORE is confirmed absent from the
    // current file. We do NOT use case-insensitive "explore" or "novel approach"
    // because "novel approach" already appears in the existing file (line 49)
    // in a different context, which would cause a false positive.
    const hasExploreStrategy =
      /\bEXPLORE\b/.test(claudeMdContent) ||
      /EXPLORE lane/.test(claudeMdContent);

    // Assert
    assert.ok(
      hasExploreStrategy,
      'CLAUDE.md must contain explore strategy language for the challenger ' +
      'planner (e.g. "EXPLORE lane" or "Novel approach"). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 7 — CLAUDE.md preserves existing output format
//
// The GREEN phase adds content but must not remove the plan document JSON
// schema section. This test asserts that core fields of the output JSON
// schema are still present: plan_id, hypothesis, approach_family,
// critic_approved, target_files, steps, expected_outcome, history_reference.
//
// This test PASSES in the RED phase (regression guard) — it verifies the
// existing schema is intact before the GREEN phase modifies the file.
// ---------------------------------------------------------------------------

describe('CLAUDE.md preserves existing output format', () => {
  it('should retain the plan document JSON schema fields in the output section', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — check for the core JSON schema fields that must survive the
    // GREEN phase edit. These fields appear as JSON keys in the Output Format
    // section of the existing CLAUDE.md.
    const requiredFields = [
      'plan_id',
      'hypothesis',
      'approach_family',
      'critic_approved',
      'target_files',
      'steps',
      'expected_outcome',
      'history_reference',
    ];

    const missingFields = requiredFields.filter(
      (field) => !claudeMdContent.includes(`"${field}"`)
    );

    // Assert
    assert.deepEqual(
      missingFields,
      [],
      'CLAUDE.md must preserve all existing JSON schema fields in the output ' +
      `section. Missing fields: ${missingFields.join(', ')}. ` +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 8 — CLAUDE.md preserves existing constraints
//
// The GREEN phase adds new constraints but must not remove any of the existing
// constraint bullet points from the Constraints section. This test checks for
// the distinctive opening phrase of each existing bullet.
//
// Existing bullets (from current CLAUDE.md at lines 110-117):
//   - ONE hypothesis only.
//   - MUST reference iteration history.
//   - MUST use a structured `approach_family` tag
//   - Output MUST be valid JSON
//   - Do NOT propose changes to files marked as sealed
//   - Do NOT repeat an `approach_family` if it has appeared 3+
//   - Do NOT duplicate the approach of another planner
//
// This test PASSES in the RED phase (regression guard).
// ---------------------------------------------------------------------------

describe('CLAUDE.md preserves existing constraints', () => {
  it('should retain all original constraint bullet points in the constraints section', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-planner CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — verify each existing constraint bullet's distinctive phrase
    // is still present in the file. These are the exact phrases from the
    // current CLAUDE.md Constraints section.
    const requiredConstraintPhrases = [
      'ONE hypothesis only',
      'MUST reference iteration history',
      'MUST use a structured',
      'Output MUST be valid JSON',
      'Do NOT propose changes to files marked as sealed',
      'Do NOT repeat an',
      'Do NOT duplicate the approach',
    ];

    const missingConstraints = requiredConstraintPhrases.filter(
      (phrase) => !claudeMdContent.includes(phrase)
    );

    // Assert
    assert.deepEqual(
      missingConstraints,
      [],
      'CLAUDE.md must preserve all original constraint bullet points. ' +
      `Missing phrases: ${missingConstraints.map((p) => `"${p}"`).join(', ')}. ` +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});
