/**
 * Structural tests for CLAUDE.md Step 9½ retrospection + Step 10 plateau reshape (Task 8.6)
 *
 * Reads CLAUDE.md and checks for required string presence.
 * These tests FAIL before Step 9½ (retrospection) is added (RED phase).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

describe('CLAUDE.md Step 9½ retrospection + Step 10 plateau reshape (8.6)', () => {
  it('CLAUDE.md contains Step 9½ retrospection section', () => {
    const hasStep =
      content.includes('9½') || content.includes('9.5');
    const hasRetrospection = content.includes('retrospection');
    assert.ok(
      hasStep,
      'Expected "9½" or "9.5" to appear in CLAUDE.md (Step 9½ heading)'
    );
    assert.ok(
      hasRetrospection,
      'Expected "retrospection" to appear in CLAUDE.md (Step 9½ section)'
    );
  });

  it('Step 9½ is conditional on retrospection.enabled', () => {
    assert.ok(
      content.includes('retrospection.enabled'),
      'Expected "retrospection.enabled" to appear in CLAUDE.md (feature flag gate)'
    );
  });

  it('Step 9½ defines signal types: plateau, high failure, family concentration, near-miss', () => {
    const lc = content.toLowerCase();
    assert.ok(
      lc.includes('plateau'),
      'Expected "plateau" signal to appear in CLAUDE.md Step 9½'
    );
    const hasHighFailure =
      lc.includes('high failure') || lc.includes('high_failure') || lc.includes('failure_rate');
    assert.ok(
      hasHighFailure,
      'Expected "high failure" or "failure_rate" signal to appear in CLAUDE.md Step 9½'
    );
    const hasFamilyConcentration =
      lc.includes('family concentration') || lc.includes('family_concentration');
    assert.ok(
      hasFamilyConcentration,
      'Expected "family concentration" or "family_concentration" signal to appear in CLAUDE.md Step 9½'
    );
    const hasNearMiss =
      lc.includes('near-miss') || lc.includes('near_miss');
    assert.ok(
      hasNearMiss,
      'Expected "near-miss" or "near_miss" signal to appear in CLAUDE.md Step 9½'
    );
  });

  it('Step 10 includes reshape-before-stop for plateau', () => {
    assert.ok(
      content.includes('reshape'),
      'Expected "reshape" to appear in CLAUDE.md (plateau reshape-before-stop logic)'
    );
    // The plateau stop condition must reference reshape in proximity
    const plateauIdx = content.indexOf('Plateau');
    const step10Idx = content.indexOf('Step 10 —');
    assert.ok(
      step10Idx !== -1,
      'Expected "Step 10 —" heading to appear in CLAUDE.md'
    );
    const step10Content = content.slice(step10Idx);
    assert.ok(
      step10Content.includes('reshape'),
      'Expected "reshape" to appear in Step 10 section of CLAUDE.md (plateau reshape condition)'
    );
  });
});
