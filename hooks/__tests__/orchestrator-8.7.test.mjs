/**
 * Structural tests for CLAUDE.md delegation reference table updates (Task 8.7)
 *
 * Reads CLAUDE.md and checks for required string presence.
 * These tests FAIL before delegation tables are updated (RED phase).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

describe('CLAUDE.md delegation reference tables (8.7)', () => {
  it('Delegation table lists 3 researcher instances', () => {
    const hasThreeResearchers =
      (content.includes('Researcher-Repo') &&
        content.includes('Researcher-Ext') &&
        content.includes('Researcher-Fail')) ||
      content.includes('3 in parallel');
    assert.ok(
      hasThreeResearchers,
      'Expected "Researcher-Repo", "Researcher-Ext", "Researcher-Fail" or "3 in parallel" in delegation table'
    );
  });

  it('Delegation table lists planner as Teammate', () => {
    const lc = content.toLowerCase();
    assert.ok(
      lc.includes('teammate'),
      'Expected "Teammate" or "teammate" type for planners in delegation table'
    );
  });

  it('Agent invocation arguments include mode parameter for researcher', () => {
    assert.ok(
      content.includes('mode={repo|external|failure}'),
      'Expected "mode={repo|external|failure}" in researcher invocation arguments'
    );
  });

  it('Agent invocation arguments include role parameter for planner', () => {
    assert.ok(
      content.includes('role='),
      'Expected "role=" in planner invocation arguments'
    );
  });

  it('Delegation table includes si-team-manager skill', () => {
    assert.ok(
      content.includes('/si-team-manager'),
      'Expected "/si-team-manager" to appear in the delegation reference table'
    );
  });
});
