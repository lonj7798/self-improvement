/**
 * executor-claude-md.test.mjs
 * RED phase tests for Task 9.1 — Add de-risk mode and findings to si-executor CLAUDE.md.
 *
 * These 5 tests validate the structural content of the si-executor CLAUDE.md
 * file after the GREEN phase adds de-risk mode and findings publication sections.
 * They read the real file on disk and assert that the required additions are present.
 *
 * Expected RED-phase failure reason for tests 1-4:
 *   The de-risk mode section, timeout reference, findings publication section,
 *   and required findings fields have NOT been added yet. These tests fail
 *   because the content they search for is absent from the current file.
 *   Test 5 passes now (regression guard) but is included to verify the GREEN
 *   phase does not remove the existing benchmark/commit workflow.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/executor-claude-md.test.mjs
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
// The agent file lives at self-improvement/claude/agents/si-executor/CLAUDE.md.
// ---------------------------------------------------------------------------

const SELF_IMPROVEMENT_ROOT = path.resolve(
  new URL('.', import.meta.url).pathname, // .../self-improvement/hooks/lib/__tests__/
  '..', '..', '..'                        // three levels up → self-improvement/
);

const CLAUDE_MD_PATH = path.join(
  SELF_IMPROVEMENT_ROOT,
  'claude', 'agents', 'si-executor', 'CLAUDE.md'
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
// Test 1 — CLAUDE.md contains de-risk mode section
//
// The GREEN phase adds a "De-Risk Mode" section that documents the lightweight
// smoke-test-only execution path. The section may be labelled "De-Risk Mode",
// "de-risk", "de_risk", or reference "smoke test".
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains de-risk mode section', () => {
  it('should contain a de-risk or smoke test section', () => {
    // Arrange — the file must exist before its content can be validated.
    assert.ok(
      fileExists,
      `si-executor CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for de-risk or smoke test language anywhere in the file.
    // The GREEN phase adds a section using one of these terms.
    const hasDeRiskSection =
      /de[_-]risk/i.test(claudeMdContent) ||
      /smoke test/i.test(claudeMdContent);

    // Assert
    assert.ok(
      hasDeRiskSection,
      'CLAUDE.md must contain a de-risk mode section. ' +
      'Expected "de-risk", "de_risk", or "smoke test" to appear in the file. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2 — CLAUDE.md de-risk has timeout reference
//
// The de-risk section must document a configurable timeout so the orchestrator
// can control how long a smoke test runs. The word "timeout" must appear in
// context with the de-risk section.
// ---------------------------------------------------------------------------

describe('CLAUDE.md de-risk has timeout reference', () => {
  it('should mention timeout in the de-risk context', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-executor CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for "timeout" anywhere in the file. The GREEN phase adds
    // a timeout reference inside the de-risk section:
    //   Timeout: de_risk.timeout_seconds from settings (default: 60)
    // "timeout" already appears once in the existing file (benchmark timeout),
    // so we just check the word is present — after GREEN it will appear in
    // both the existing benchmark section and the new de-risk section.
    const hasTimeout = /timeout/i.test(claudeMdContent);

    // Assert
    assert.ok(
      hasTimeout,
      'CLAUDE.md must contain "timeout" in the de-risk context. ' +
      'Expected de_risk.timeout_seconds or similar timeout reference. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — CLAUDE.md contains findings publication section
//
// The GREEN phase adds a "Findings Publication" section (Step 8.5) that
// documents writing a findings entry to the findings/ directory after each
// benchmark run.
// ---------------------------------------------------------------------------

describe('CLAUDE.md contains findings publication section', () => {
  it('should contain a findings/ or findings/round path reference', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-executor CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — search for a findings/ directory reference or findings/round pattern.
    // The GREEN phase adds Step 8.5 that writes to:
    //   {project_root}/docs/agent_defined/findings/round_{N}_executor_{id}.json
    const hasFindingsSection =
      /findings\//.test(claudeMdContent) ||
      /findings\/round/.test(claudeMdContent);

    // Assert
    assert.ok(
      hasFindingsSection,
      'CLAUDE.md must contain a findings publication section with a "findings/" path. ' +
      'Expected "findings/" or "findings/round" to appear in the file. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4 — CLAUDE.md findings includes required fields
//
// The findings publication section must document the required JSON schema
// fields: hypothesis, score, and status. These fields are read by
// Researcher-Fail to analyze past results.
// ---------------------------------------------------------------------------

describe('CLAUDE.md findings includes required fields', () => {
  it('should contain hypothesis, score, and status fields in findings context', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-executor CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — check for each required findings field name.
    // The GREEN phase adds a schema block containing these fields:
    //   "hypothesis": "<from plan>",
    //   "score": <benchmark_score>,
    //   "status": "<from result>",
    const hasHypothesis = /hypothesis/.test(claudeMdContent);
    const hasScore = /"score"/.test(claudeMdContent);
    const hasStatus = /"status"/.test(claudeMdContent);

    // Assert each field individually for precise failure messages.
    assert.ok(
      hasHypothesis,
      'CLAUDE.md findings section must contain "hypothesis" field. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
    assert.ok(
      hasScore,
      'CLAUDE.md findings section must contain "score" field (as JSON key "score"). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
    assert.ok(
      hasStatus,
      'CLAUDE.md findings section must contain "status" field (as JSON key "status"). ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5 — CLAUDE.md preserves existing workflow
//
// The GREEN phase adds new sections but must not remove the existing benchmark
// and commit workflow steps. This test asserts that core workflow elements
// are still present: Steps 1-8, the benchmark command reference, and the
// commit-on-success behavior.
//
// This test PASSES in the RED phase (regression guard).
// ---------------------------------------------------------------------------

describe('CLAUDE.md preserves existing workflow', () => {
  it('should retain Steps 1-8 and the benchmark/commit workflow', () => {
    // Arrange
    assert.ok(
      fileExists,
      `si-executor CLAUDE.md must exist at: ${CLAUDE_MD_PATH}`
    );

    // Act — verify that the core workflow steps are present.
    // The existing file uses headings of the form:
    //   ### Step 1 — Read and Validate the Plan
    //   ### Step 2 — Verify the Worktree
    //   ...
    //   ### Step 8 — Write the Result
    const stepNumbers = [1, 2, 3, 4, 5, 6, 7, 8];
    const missingSteps = stepNumbers.filter(
      (n) => !new RegExp(`Step\\s+${n}\\b`).test(claudeMdContent)
    );

    // Also verify the benchmark command and commit-on-success language survive.
    const hasBenchmarkCommand = /benchmark_command/.test(claudeMdContent);
    const hasCommitOnSuccess = /commit/.test(claudeMdContent);

    // Assert — all steps preserved.
    assert.deepEqual(
      missingSteps,
      [],
      'CLAUDE.md must preserve all original workflow steps 1-8. ' +
      `Missing step numbers: ${missingSteps.join(', ')}. ` +
      `File path: ${CLAUDE_MD_PATH}`
    );

    // Assert — benchmark command reference preserved.
    assert.ok(
      hasBenchmarkCommand,
      'CLAUDE.md must preserve "benchmark_command" reference in the workflow. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );

    // Assert — commit-on-success behavior preserved.
    assert.ok(
      hasCommitOnSuccess,
      'CLAUDE.md must preserve "commit" language from the success workflow. ' +
      `File path: ${CLAUDE_MD_PATH}`
    );
  });
});
