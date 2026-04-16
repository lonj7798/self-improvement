/**
 * retrospection.test.mjs
 * RED phase tests for self-improvement/hooks/lib/retrospection.mjs
 * All 7 tests must FAIL until the implementation file is created.
 *
 * Run: node --test hooks/lib/__tests__/retrospection.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import from the module that does NOT exist yet — this is the RED phase.
// Every test will fail at module-load time with ERR_MODULE_NOT_FOUND.
import {
  detectPlateau,
  detectHighFailureRate,
  detectFamilyConcentration,
  detectNearMiss,
} from '../retrospection.mjs';

// ---------------------------------------------------------------------------
// Tests: detectPlateau
// ---------------------------------------------------------------------------

describe('detectPlateau', () => {
  it('returns true when improvement below threshold for window rounds', () => {
    // Arrange: 3 winners with tiny improvement deltas — all below the 0.01 threshold
    const recentWinners = [
      { score: 1.000 },
      { score: 1.002 },
      { score: 1.003 },
    ];
    const threshold = 0.01;  // 1% minimum improvement
    const window = 3;

    // Act
    const result = detectPlateau(recentWinners, threshold, window);

    // Assert: plateau detected — returns a truthy signal object
    assert.ok(result !== null, 'should return a signal when plateau detected');
    assert.equal(result.signal, 'plateau');
  });

  it('returns false when recent improvement exists', () => {
    // Arrange: last improvement is well above the threshold
    const recentWinners = [
      { score: 1.000 },
      { score: 1.002 },
      { score: 1.050 },  // +5% improvement — above threshold
    ];
    const threshold = 0.01;
    const window = 3;

    // Act
    const result = detectPlateau(recentWinners, threshold, window);

    // Assert: no plateau — returns null
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// Tests: detectHighFailureRate
// ---------------------------------------------------------------------------

describe('detectHighFailureRate', () => {
  it('returns true when >50% plans failed', () => {
    // Arrange: 3 of 4 plans failed (75% failure rate — above 50% threshold)
    const roundResults = [
      { status: 'failed' },
      { status: 'failed' },
      { status: 'failed' },
      { status: 'success' },
    ];
    const threshold = 50;  // 50% failure rate threshold

    // Act
    const result = detectHighFailureRate(roundResults, threshold);

    // Assert: high failure rate detected
    assert.ok(result !== null, 'should return a signal when failure rate is high');
    assert.equal(result.signal, 'high_failure_rate');
  });

  it('returns false for normal failure rate', () => {
    // Arrange: only 1 of 4 plans failed (25% — below threshold)
    const roundResults = [
      { status: 'success' },
      { status: 'success' },
      { status: 'success' },
      { status: 'failed' },
    ];
    const threshold = 50;

    // Act
    const result = detectHighFailureRate(roundResults, threshold);

    // Assert: no signal
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// Tests: detectFamilyConcentration
// ---------------------------------------------------------------------------

describe('detectFamilyConcentration', () => {
  it('returns family name when same family won 2+ of last 3', () => {
    // Arrange: "caching" won twice in last 3 rounds
    const recentWinners = [
      { approach_family: 'indexing' },
      { approach_family: 'caching' },
      { approach_family: 'caching' },
    ];
    const window = 3;

    // Act
    const result = detectFamilyConcentration(recentWinners, window);

    // Assert: concentration detected, family name returned
    assert.ok(result !== null, 'should return a signal when family is concentrated');
    assert.equal(result.signal, 'family_concentration');
    assert.equal(result.family, 'caching');
  });

  it('returns null for diverse winners', () => {
    // Arrange: all different families
    const recentWinners = [
      { approach_family: 'indexing' },
      { approach_family: 'caching' },
      { approach_family: 'batching' },
    ];
    const window = 3;

    // Act
    const result = detectFamilyConcentration(recentWinners, window);

    // Assert: no concentration
    assert.equal(result, null);
  });
});

// ---------------------------------------------------------------------------
// Tests: detectNearMiss
// ---------------------------------------------------------------------------

describe('detectNearMiss', () => {
  it('returns loser entry when score within threshold of winner', () => {
    // Arrange: winner scored 1.000, near-miss loser scored 0.991 (0.9% below — within 2% threshold)
    const roundResults = [
      { plan_id: 'plan_a', score: 1.000, is_winner: true },
      { plan_id: 'plan_b', score: 0.991, is_winner: false },
      { plan_id: 'plan_c', score: 0.800, is_winner: false },
    ];
    const thresholdPct = 2;  // within 2% of winner

    // Act
    const result = detectNearMiss(roundResults, thresholdPct);

    // Assert: near-miss found — plan_b
    assert.ok(result !== null, 'should return a signal when near-miss exists');
    assert.equal(result.signal, 'near_miss');
    assert.equal(result.plan_id, 'plan_b');
  });
});
