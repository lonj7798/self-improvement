/**
 * Structural tests for CLAUDE.md Teammate Management section (Task 8.1)
 *
 * Reads CLAUDE.md and checks for required string presence.
 * These tests FAIL before the section is added (RED phase).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');

const content = readFileSync(CLAUDE_MD_PATH, 'utf8');

describe('CLAUDE.md Teammate Management section (8.1)', () => {
  it('CLAUDE.md references /si-team-manager for all teammate ops', () => {
    // /si-team-manager must be mentioned for create, kill, and handoff operations
    assert.ok(
      content.includes('/si-team-manager'),
      'Expected /si-team-manager to be referenced in CLAUDE.md'
    );
    assert.ok(
      content.includes('/si-team-manager create'),
      'Expected /si-team-manager create to be documented'
    );
    assert.ok(
      content.includes('/si-team-manager kill'),
      'Expected /si-team-manager kill to be documented'
    );
    assert.ok(
      content.includes('/si-team-manager handoff'),
      'Expected /si-team-manager handoff to be documented'
    );
  });

  it('CLAUDE.md states Claude never touches registry directly', () => {
    // Must contain explicit NEVER prohibition on TeamCreate, TeamDelete, and direct registry writes
    assert.ok(
      content.includes('NEVER'),
      'Expected NEVER prohibition to appear in CLAUDE.md'
    );
    assert.ok(
      content.includes('TeamCreate') || content.includes('TeamDelete'),
      'Expected TeamCreate or TeamDelete to be explicitly prohibited'
    );
    // The prohibition must be connected to NEVER — check for explicit disallowance
    const neverBlock = content.match(/\*\*NEVER\*\*[^\n]*(TeamCreate|TeamDelete)[^\n]*/);
    assert.ok(
      neverBlock !== null,
      'Expected a **NEVER** ... TeamCreate/TeamDelete prohibition line in CLAUDE.md'
    );
  });

  it('CLAUDE.md defines teammate_registry.json as managed state', () => {
    assert.ok(
      content.includes('teammate_registry.json'),
      'Expected teammate_registry.json to be referenced in CLAUDE.md'
    );
  });
});
