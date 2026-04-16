/**
 * retrospection.mjs — Pure signal detection helpers for retrospection analysis.
 * No file I/O. All functions take explicit inputs and return signal objects or null.
 *
 * @calling-spec
 * - detectPlateau(recentWinners, threshold, window): {signal:"plateau"}|null
 *   Input: [{score}] oldest-first, min-improvement ratio, rounds to check
 *   Output: signal if all consecutive improvements < threshold, else null
 *
 * - detectHighFailureRate(roundResults, threshold): {signal:"high_failure_rate",rate}|null
 *   Input: [{status}], failure percentage threshold (0-100)
 *   Output: signal if failure% > threshold, else null
 *
 * - detectFamilyConcentration(recentWinners, window): {signal:"family_concentration",family}|null
 *   Input: [{approach_family}] oldest-first, rounds to check
 *   Output: signal with dominant family if one won 2+ of last window, else null
 *
 * - detectNearMiss(roundResults, thresholdPct): {signal:"near_miss",plan_id,score}|null
 *   Input: [{plan_id,score,is_winner}], closeness percentage (0-100)
 *   Output: signal for closest loser within thresholdPct of winner, else null
 */

/** Returns plateau signal if all adjacent score improvements in last `window` entries are below threshold. */
export function detectPlateau(recentWinners, threshold, window) {
  const slice = recentWinners.slice(-window);
  if (slice.length < 2) return null;

  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1].score;
    const curr = slice[i].score;
    const improvement = prev === 0 ? 0 : Math.abs(curr - prev) / Math.abs(prev);
    if (improvement >= threshold) return null;
  }

  return { signal: 'plateau' };
}

/** Returns high_failure_rate signal if non-success results exceed threshold percent. */
export function detectHighFailureRate(roundResults, threshold) {
  if (!roundResults || roundResults.length === 0) return null;

  const failed = roundResults.filter(r => r.status !== 'success').length;
  const rate = (failed / roundResults.length) * 100;

  if (rate > threshold) return { signal: 'high_failure_rate', rate };
  return null;
}

/** Returns family_concentration signal if one approach_family appears 2+ times in last `window` winners. */
export function detectFamilyConcentration(recentWinners, window) {
  const slice = recentWinners.slice(-window);
  if (slice.length < 2) return null;

  const counts = {};
  for (const w of slice) {
    const fam = w.approach_family;
    counts[fam] = (counts[fam] ?? 0) + 1;
  }

  for (const [family, count] of Object.entries(counts)) {
    if (count >= 2) return { signal: 'family_concentration', family };
  }

  return null;
}

/** Returns near_miss signal for the closest loser within thresholdPct of the winner score. */
export function detectNearMiss(roundResults, thresholdPct) {
  const winner = roundResults.find(r => r.is_winner);
  if (!winner) return null;

  const winnerScore = winner.score;
  const losers = roundResults.filter(r => !r.is_winner);

  let best = null;
  let bestDiff = Infinity;

  for (const loser of losers) {
    const diff = winnerScore === 0 ? 0 : Math.abs(winnerScore - loser.score) / Math.abs(winnerScore) * 100;
    if (diff <= thresholdPct && diff < bestDiff) {
      bestDiff = diff;
      best = loser;
    }
  }

  if (!best) return null;
  return { signal: 'near_miss', plan_id: best.plan_id, score: best.score };
}
