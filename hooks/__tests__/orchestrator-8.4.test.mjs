/**
 * Structural tests for CLAUDE.md Steps 7a.5 and 7c -- hybrid planner and de-risk (Task 8.4)
 *
 * Reads CLAUDE.md and checks for required string presence.
 * These tests FAIL before Steps 7a.5 and 7c are added (RED phase).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

describe('CLAUDE.md Steps 7a.5 and 7c -- hybrid planner and de-risk (8.4)', () => {
  it('CLAUDE.md contains Step 7a.5 hybrid planner section', () => {
    const hasHybrid = content.includes('hybrid');
    const hasStep7a5 =
      content.includes('7a.5') || content.includes('7a½') || content.includes('Step 7a½');
    assert.ok(
      hasHybrid,
      'Expected "hybrid" to appear in CLAUDE.md'
    );
    assert.ok(
      hasStep7a5,
      'Expected "7a.5" or "Step 7a½" to appear in CLAUDE.md'
    );
  });

  it('Step 7a.5 is conditional on hybrid_planner.enabled', () => {
    assert.ok(
      content.includes('hybrid_planner.enabled'),
      'Expected "hybrid_planner.enabled" to appear in CLAUDE.md (feature flag for Step 7a.5)'
    );
  });

  it('CLAUDE.md contains Step 7c de-risk section', () => {
    const hasDeRisk =
      content.includes('de-risk') || content.includes('de_risk');
    const has7c = content.includes('7c');
    assert.ok(
      hasDeRisk,
      'Expected "de-risk" or "de_risk" to appear in CLAUDE.md'
    );
    assert.ok(
      has7c,
      'Expected "7c" to appear in CLAUDE.md'
    );
  });

  it('Step 7c is conditional on de_risk.enabled', () => {
    assert.ok(
      content.includes('de_risk.enabled'),
      'Expected "de_risk.enabled" to appear in CLAUDE.md (feature flag for Step 7c)'
    );
  });

  it('Both steps are between planning and execution', () => {
    // Step 7a.5 and 7c must appear after Step 7a/7b and before Step 8
    const step7aIndex = content.indexOf('Step 7a');
    const step8Index = content.indexOf('Step 8 —');

    assert.ok(
      step7aIndex !== -1,
      'Expected "Step 7a" to appear in CLAUDE.md'
    );
    assert.ok(
      step8Index !== -1,
      'Expected "Step 8" to appear in CLAUDE.md'
    );

    // Find Step 7a.5 (hybrid) position
    const hybrid7a5Index = content.indexOf('7a.5');
    const hybrid7aHalfIndex = content.indexOf('7a½');
    const hybridStepIndex = hybrid7a5Index !== -1 ? hybrid7a5Index : hybrid7aHalfIndex;

    // Find Step 7c position
    const step7cIndex = content.indexOf('7c');

    assert.ok(
      hybridStepIndex !== -1,
      'Expected Step 7a.5 or 7a½ to appear in CLAUDE.md'
    );
    assert.ok(
      step7cIndex !== -1,
      'Expected Step 7c to appear in CLAUDE.md'
    );

    // Both must appear after Step 7a and before Step 8
    assert.ok(
      hybridStepIndex > step7aIndex,
      'Step 7a.5 must appear after Step 7a'
    );
    assert.ok(
      hybridStepIndex < step8Index,
      'Step 7a.5 must appear before Step 8'
    );
    assert.ok(
      step7cIndex > step7aIndex,
      'Step 7c must appear after Step 7a'
    );
    assert.ok(
      step7cIndex < step8Index,
      'Step 7c must appear before Step 8'
    );
  });
});
