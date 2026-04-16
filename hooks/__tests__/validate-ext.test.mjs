/**
 * Tests that validate.sh contains the v0.0.1-B check functions.
 * Validates function presence by reading file content.
 *
 * @calling-spec
 * - (test suite): reads validate.sh and asserts string patterns
 *   Input: validate.sh file at scripts/validate.sh
 *   Output: pass/fail assertions for each required function
 *   Side effects: none
 *   Depends on: node:fs, node:path, node:test
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATE_SH = join(__dirname, '../../scripts/validate.sh');

const content = readFileSync(VALIDATE_SH, 'utf8');

describe('validate.sh v0.0.1-B extensions', () => {
  it('validate.sh contains check_teammate_registry function', () => {
    assert.ok(
      content.includes('check_teammate_registry'),
      'Expected validate.sh to contain "check_teammate_registry"'
    );
  });

  it('validate.sh contains check_notebook function', () => {
    assert.ok(
      content.includes('check_notebook'),
      'Expected validate.sh to contain "check_notebook"'
    );
  });

  it('validate.sh contains check_findings_entry function', () => {
    assert.ok(
      content.includes('check_findings'),
      'Expected validate.sh to contain "check_findings"'
    );
  });

  it('validate.sh contains H004 simplicity check', () => {
    assert.ok(
      content.includes('H004') || content.includes('simplicity'),
      'Expected validate.sh to contain "H004" or "simplicity"'
    );
  });

  it('validate.sh contains hybrid_metadata validation', () => {
    assert.ok(
      content.includes('hybrid_metadata') || content.includes('source_plans'),
      'Expected validate.sh to contain "hybrid_metadata" or "source_plans"'
    );
  });
});
