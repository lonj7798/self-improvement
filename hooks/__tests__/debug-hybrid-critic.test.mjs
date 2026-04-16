/**
 * Structural regression test for debug issue #2 --
 * When a hybrid plan is produced in Step 7a½, it must go through an
 * explicit critic review (si-plan-critic) before de-risk/execution.
 *
 * Prior to the fix, Step 7a½ contained only a prose claim that the hybrid
 * plan "goes through the same critic review (Step 7b)" without an actual
 * invocation -- and because Step 7b runs BEFORE Step 7a½ in the linear
 * flow, no loop-back existed. This test asserts the structural markers
 * that prove the critic is wired in.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAUDE_MD_PATH = join(__dirname, '..', '..', 'CLAUDE.md');
const DATA_CONTRACTS_PATH = join(
  __dirname,
  '..',
  '..',
  'docs',
  'theory',
  'data_contracts.md'
);

const claudeMd = readFileSync(CLAUDE_MD_PATH, 'utf8');
const dataContracts = readFileSync(DATA_CONTRACTS_PATH, 'utf8');

/**
 * Extract the Step 7a½ section from CLAUDE.md -- everything between
 * "### Step 7a½" and the next "### Step" heading.
 */
function extractStep7aHalf(content) {
  const startMarker = '### Step 7a½';
  const start = content.indexOf(startMarker);
  assert.ok(
    start !== -1,
    `Expected "${startMarker}" heading to appear in CLAUDE.md`
  );
  const rest = content.slice(start + startMarker.length);
  const nextHeadingMatch = rest.match(/\n### Step /);
  const end =
    nextHeadingMatch !== null ? nextHeadingMatch.index : rest.length;
  return rest.slice(0, end);
}

describe('Step 7a½ hybrid planner invokes critic review (debug #2)', () => {
  it('Step 7a½ section invokes si-plan-critic on the hybrid plan', () => {
    const section = extractStep7aHalf(claudeMd);
    assert.ok(
      /si-plan-critic|plan-critic/.test(section),
      'Expected Step 7a½ to reference "si-plan-critic" (the critic skill invocation) so hybrid plans pass through critic review'
    );
  });

  it('Step 7a½ section records critic_approved on the hybrid plan', () => {
    const section = extractStep7aHalf(claudeMd);
    assert.ok(
      /critic_approved/.test(section),
      'Expected Step 7a½ to mention "critic_approved" (write-through to iteration_state.hybrid)'
    );
  });

  it('Step 7a½ section passes planner_id=hybrid to trigger H005', () => {
    const section = extractStep7aHalf(claudeMd);
    const hasHybridPlannerId =
      /planner_id\s*[:=]\s*["']?hybrid["']?/.test(section) ||
      /planner_id\s*=\s*hybrid/.test(section);
    assert.ok(
      hasHybridPlannerId,
      'Expected Step 7a½ to pass planner_id=hybrid (or planner_id: "hybrid") so H005 hybrid redundancy check fires'
    );
  });

  it('data_contracts.md hybrid schema includes critic_approved field', () => {
    // Locate the Hybrid Plan Metadata section heading (not the TOC entry)
    // and assert critic_approved is documented inside. Matches from the
    // "## 17. Hybrid Plan Metadata" heading up to the next "## " heading.
    const hybridSectionMatch = dataContracts.match(
      /## \d+\. Hybrid Plan Metadata[\s\S]*?(?=\n## \d+\.|\n---\n\n## \d+\.|$)/
    );
    assert.ok(
      hybridSectionMatch !== null,
      'Expected "## N. Hybrid Plan Metadata" section heading in data_contracts.md'
    );
    const hybridSection = hybridSectionMatch[0];
    assert.ok(
      /critic_approved/.test(hybridSection),
      'Expected "critic_approved" to appear in the Hybrid Plan Metadata section of data_contracts.md'
    );
  });
});
