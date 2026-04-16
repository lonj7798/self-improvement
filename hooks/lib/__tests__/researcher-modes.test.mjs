/**
 * researcher-modes.test.mjs
 * RED phase tests for Task 4.1 — Researcher mode reference files.
 *
 * These 3 tests validate that the following markdown files were physically
 * created in the repository as part of the GREEN phase:
 *
 *   self-improvement/claude/agents/si-researcher/modes/repo.md
 *   self-improvement/claude/agents/si-researcher/modes/external.md
 *   self-improvement/claude/agents/si-researcher/modes/failure.md
 *
 * Each test reads the file directly with fs.readFileSync and checks for
 * required section headers. No production modules are imported — the files
 * under test are markdown documents, not code.
 *
 * Expected RED-phase failure reason for every test:
 *   self-improvement/claude/agents/si-researcher/modes/ does not exist yet;
 *   all three .md files are absent.
 *
 * Run:
 *   cd /Users/jaewon/mywork_2026/_for_fun/self-improvement-dev/self-improvement
 *   node --test hooks/lib/__tests__/researcher-modes.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Base path resolution.
// Path ancestry from this file:
//   __tests__/  --(..)--> lib/  --(..)--> hooks/  --(..)--> self-improvement/
// Three levels up from the directory containing this file reaches
// self-improvement/, which is where claude/agents/ lives.
// ---------------------------------------------------------------------------

const SELF_IMPROVEMENT_ROOT = path.resolve(
  new URL('.', import.meta.url).pathname,  // .../self-improvement/hooks/lib/__tests__/
  '..', '..', '..'                          // three levels up → self-improvement/
);

const MODES_DIR = path.join(
  SELF_IMPROVEMENT_ROOT,
  'claude', 'agents', 'si-researcher', 'modes'
);

// ---------------------------------------------------------------------------
// Test 1 — modes/repo.md exists and has required sections
// ---------------------------------------------------------------------------

describe('modes/repo.md exists and has required sections', () => {
  it('should contain Focus, Output, and Consumed By headers when file exists', () => {
    // Arrange — resolve the absolute path to the file that must exist after GREEN phase.
    const filePath = path.join(MODES_DIR, 'repo.md');

    // Act — assert existence before reading so the failure message is precise.
    assert.ok(
      fs.existsSync(filePath),
      `modes/repo.md must exist at: ${filePath}`
    );

    const content = fs.readFileSync(filePath, 'utf8');

    // Assert — all required section headers are present.
    assert.ok(
      content.includes('## Focus'),
      `modes/repo.md must contain a "## Focus" section`
    );
    assert.ok(
      content.includes('## Output'),
      `modes/repo.md must contain a "## Output" section`
    );
    assert.ok(
      content.includes('## Consumed By'),
      `modes/repo.md must contain a "## Consumed By" section`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2 — modes/external.md exists and has required sections
// ---------------------------------------------------------------------------

describe('modes/external.md exists and has required sections', () => {
  it('should contain Focus, Output, and Consumed By headers when file exists', () => {
    // Arrange — resolve the absolute path to the file that must exist after GREEN phase.
    const filePath = path.join(MODES_DIR, 'external.md');

    // Act — assert existence before reading so the failure message is precise.
    assert.ok(
      fs.existsSync(filePath),
      `modes/external.md must exist at: ${filePath}`
    );

    const content = fs.readFileSync(filePath, 'utf8');

    // Assert — all required section headers are present.
    assert.ok(
      content.includes('## Focus'),
      `modes/external.md must contain a "## Focus" section`
    );
    assert.ok(
      content.includes('## Output'),
      `modes/external.md must contain a "## Output" section`
    );
    assert.ok(
      content.includes('## Consumed By'),
      `modes/external.md must contain a "## Consumed By" section`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — modes/failure.md exists and has required sections
// (failure mode has an additional "## Additional Inputs" section)
// ---------------------------------------------------------------------------

describe('modes/failure.md exists and has required sections', () => {
  it('should contain Focus, Output, Consumed By, and Additional Inputs headers when file exists', () => {
    // Arrange — resolve the absolute path to the file that must exist after GREEN phase.
    const filePath = path.join(MODES_DIR, 'failure.md');

    // Act — assert existence before reading so the failure message is precise.
    assert.ok(
      fs.existsSync(filePath),
      `modes/failure.md must exist at: ${filePath}`
    );

    const content = fs.readFileSync(filePath, 'utf8');

    // Assert — all required section headers are present, including the extra
    // "## Additional Inputs" section that is unique to the failure mode.
    assert.ok(
      content.includes('## Focus'),
      `modes/failure.md must contain a "## Focus" section`
    );
    assert.ok(
      content.includes('## Output'),
      `modes/failure.md must contain a "## Output" section`
    );
    assert.ok(
      content.includes('## Consumed By'),
      `modes/failure.md must contain a "## Consumed By" section`
    );
    assert.ok(
      content.includes('## Additional Inputs'),
      `modes/failure.md must contain a "## Additional Inputs" section (unique to failure mode)`
    );
  });
});
