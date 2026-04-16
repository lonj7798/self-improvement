/**
 * researcher-claude-md.test.mjs
 * RED phase tests for Task 4.2 — Update si-researcher CLAUDE.md.
 *
 * These 4 tests validate the structural content of the si-researcher CLAUDE.md
 * file after the GREEN phase adds mode parameter routing. They read the real
 * file on disk and assert that the required additions are present.
 *
 * Expected RED-phase failure reason for every test:
 *   The mode parameter, modes/ directory reference, mode-specific output paths,
 *   and the Mode Routing section have NOT been added yet. Tests fail because
 *   the content they search for is absent from the current file.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/researcher-claude-md.test.mjs
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
// The agent file lives at self-improvement/claude/agents/si-researcher/CLAUDE.md.
// ---------------------------------------------------------------------------

const SELF_IMPROVEMENT_ROOT = path.resolve(
  new URL('.', import.meta.url).pathname, // .../self-improvement/hooks/lib/__tests__/
  '..', '..', '..'                        // three levels up → self-improvement/
);

const CLAUDE_MD_PATH = path.join(
  SELF_IMPROVEMENT_ROOT,
  'claude', 'agents', 'si-researcher', 'CLAUDE.md'
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
// Test 1 — CLAUDE.md contains mode parameter in input contract
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains mode parameter in input contract', () => {
  it('should contain mode= parameter in the arguments/input contract section', () => {
    // Arrange — the file must exist before its content can be validated.
    assert.ok(
      fileExists,
      `si-researcher CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for the mode parameter pattern anywhere in the input contract.
    // The GREEN phase adds: mode=<repo|external|failure>
    // Accept either the full form or the bare key to be flexible across
    // minor wording differences, but require "mode=" to be present.
    const hasModeParameter = /\bmode=/.test(claudeMdContent);

    // Assert
    assert.ok(
      hasModeParameter,
      'CLAUDE.md must contain "mode=" in the input contract section ' +
      '(e.g. "mode=<repo|external|failure>"). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2 — CLAUDE.md references modes/ directory
// ---------------------------------------------------------------------------

describe('CLAUDE.md references modes/ directory', () => {
  it('should contain a modes/ path reference for mode routing', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-researcher CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for a modes/ directory reference.
    // The GREEN phase adds a Mode Routing section that reads:
    //   mode=repo: Read modes/repo.md
    //   mode=external: Read modes/external.md
    //   mode=failure: Read modes/failure.md
    const hasModesDirectory = /modes\//.test(claudeMdContent);

    // Assert
    assert.ok(
      hasModesDirectory,
      'CLAUDE.md must contain at least one "modes/" path reference ' +
      '(e.g. "modes/repo.md", "modes/external.md", "modes/failure.md"). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — CLAUDE.md has 3 distinct output paths
// ---------------------------------------------------------------------------

describe('CLAUDE.md has 3 distinct output paths', () => {
  it('should contain brief_repo, brief_ext, and brief_fail output identifiers', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-researcher CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — check for each of the 3 mode-specific output path identifiers.
    // The GREEN phase updates the Output section to include:
    //   brief_repo.json  (mode=repo)
    //   brief_ext.json   (mode=external)
    //   brief_fail.json  (mode=failure)
    const hasBriefRepo = /brief_repo/.test(claudeMdContent);
    const hasBriefExt  = /brief_ext/.test(claudeMdContent);
    const hasBriefFail = /brief_fail/.test(claudeMdContent);

    // Assert each identifier individually so the failure message names the
    // missing identifier precisely.
    assert.ok(
      hasBriefRepo,
      'CLAUDE.md must contain "brief_repo" (output path for mode=repo). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
    assert.ok(
      hasBriefExt,
      'CLAUDE.md must contain "brief_ext" (output path for mode=external). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
    assert.ok(
      hasBriefFail,
      'CLAUDE.md must contain "brief_fail" (output path for mode=failure). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4 — CLAUDE.md preserves existing workflow steps
//
// The GREEN phase modifies the file by inserting a Mode Routing section and
// other additions. This test asserts two things about the result:
//
//   a) All 8 original workflow steps (Step 1 – Step 8) still exist — the
//      GREEN phase must not remove or renumber them. This assertion passes
//      now and acts as a regression guard.
//
//   b) A "Mode Routing" section header is present — this is the new section
//      injected by the GREEN phase between the Input Contract and Workflow.
//      This assertion fails now (the section does not exist yet) and is what
//      makes the entire test RED.
//
// Both assertions belong in one test because they validate the same contract:
// the file was modified by adding mode routing WITHOUT destroying the steps.
// ---------------------------------------------------------------------------

describe('CLAUDE.md preserves existing workflow steps', () => {
  it('should retain Steps 1-8 and contain the new Mode Routing section', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-researcher CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — verify that the 8 original workflow steps are present.
    // The existing file (179 LOC before GREEN) uses headings of the form:
    //   ### Step 1 — Read the goal
    //   ### Step 2 — Read all iteration history
    //   ...
    //   ### Step 8 — Write the research brief
    // The GREEN phase must not remove or renumber any of these steps.
    const stepNumbers = [1, 2, 3, 4, 5, 6, 7, 8];
    const missingSteps = stepNumbers.filter(
      (n) => !new RegExp(`Step\\s+${n}\\b`).test(claudeMdContent)
    );

    // Act — verify the new Mode Routing section header was added by the GREEN phase.
    // The plan specifies a section named "## Mode Routing" (or "Mode Routing" as a
    // heading at any level) that documents how mode values map to reference files.
    const hasModeRoutingSection = /Mode Routing/.test(claudeMdContent);

    // Assert — steps must all be preserved (regression guard).
    assert.deepEqual(
      missingSteps,
      [],
      `CLAUDE.md must preserve all original workflow steps. ` +
      `Missing step numbers: ${missingSteps.join(', ')}. ` +
      `File path: ${CLAUDE_MD_PATH}`
    );

    // Assert — Mode Routing section must exist (this is the RED-phase trigger).
    assert.ok(
      hasModeRoutingSection,
      'CLAUDE.md must contain a "Mode Routing" section added by the GREEN phase. ' +
      'This section documents how mode=repo|external|failure maps to reference files. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});
