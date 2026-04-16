/**
 * Structural tests for CLAUDE.md Step 6 rewrite -- 3 researchers (Task 8.2)
 *
 * Reads CLAUDE.md and checks for required string presence.
 * These tests FAIL before Step 6 is rewritten (RED phase).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

describe('CLAUDE.md Step 6 -- 3 researchers (8.2)', () => {
  it('Step 6 spawns 3 researchers with distinct modes', () => {
    // Step 6 must reference mode=repo, mode=external, and mode=failure
    assert.ok(
      content.includes('mode=repo'),
      'Expected mode=repo to appear in CLAUDE.md Step 6'
    );
    assert.ok(
      content.includes('mode=external'),
      'Expected mode=external to appear in CLAUDE.md Step 6'
    );
    assert.ok(
      content.includes('mode=failure'),
      'Expected mode=failure to appear in CLAUDE.md Step 6'
    );
  });

  it('Step 6 output references 3 brief files', () => {
    // Step 6 must document 3 distinct output brief paths
    assert.ok(
      content.includes('brief_repo.json'),
      'Expected brief_repo.json to appear in CLAUDE.md Step 6'
    );
    assert.ok(
      content.includes('brief_ext.json'),
      'Expected brief_ext.json to appear in CLAUDE.md Step 6'
    );
    assert.ok(
      content.includes('brief_fail.json'),
      'Expected brief_fail.json to appear in CLAUDE.md Step 6'
    );
  });

  it('Step 6 preserves error handling for missing briefs', () => {
    // Must document fallback/retry behavior when a researcher brief is missing
    const hasRetry = content.includes('retry once');
    const hasProceed = content.includes('proceed with available briefs');
    const hasLog = content.includes('log which researcher failed');
    assert.ok(
      hasRetry,
      'Expected "retry once" fallback behavior documented in Step 6'
    );
    assert.ok(
      hasProceed,
      'Expected "proceed with available briefs" documented in Step 6'
    );
    assert.ok(
      hasLog,
      'Expected "log which researcher failed" documented in Step 6'
    );
  });
});
