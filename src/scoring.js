/**
 * Pure scoring math. No storage, no side effects.
 *
 * Rules (v1):
 *   - +10 for each pick that matches the recorded result
 *   - +5 perfect-week bonus if every pick scored is correct (min 3 scored)
 *   - 0 for picks where no result is yet recorded (returned as `pending`)
 */

const POINTS_PER_HIT = 10;
const PERFECT_BONUS = 5;
const PERFECT_MIN_PICKS = 3;

/**
 * @param {Record<string, 'left' | 'right'>} picks
 * @param {Record<string, 'left' | 'right' | null>} results
 * @returns {{
 *   pointsEarned: number,
 *   correct: number,
 *   wrong: number,
 *   pending: number,
 *   total: number,
 *   perfect: boolean,
 * }}
 */
export function scoreWeek(picks, results) {
  const safePicks = picks || {};
  const safeResults = results || {};
  let correct = 0;
  let wrong = 0;
  let pending = 0;
  for (const [gameId, pick] of Object.entries(safePicks)) {
    if (pick !== 'left' && pick !== 'right') continue;
    const result = safeResults[gameId];
    if (result === 'left' || result === 'right') {
      if (result === pick) correct += 1;
      else wrong += 1;
    } else {
      pending += 1;
    }
  }
  const scored = correct + wrong;
  const perfect =
    scored >= PERFECT_MIN_PICKS && correct === scored && wrong === 0;
  let pointsEarned = correct * POINTS_PER_HIT;
  if (perfect) pointsEarned += PERFECT_BONUS;
  return {
    pointsEarned,
    correct,
    wrong,
    pending,
    total: Object.keys(safePicks).length,
    perfect,
  };
}

/** Sum scoring across many weekly entries from history. */
export function scoreSeason(entries) {
  if (!Array.isArray(entries)) return { pointsEarned: 0, correct: 0, weeks: 0 };
  let pointsEarned = 0;
  let correct = 0;
  for (const e of entries) {
    pointsEarned += Number.isFinite(e.pointsEarned) ? e.pointsEarned : 0;
    correct += Number.isFinite(e.correct) ? e.correct : 0;
  }
  return { pointsEarned, correct, weeks: entries.length };
}

/** Per-week point series newest-first → oldest-first for charting. */
export function pointsCurve(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .slice()
    .reverse()
    .map((e) => ({
      weekLabel: e.weekLabel || '',
      points: Number.isFinite(e.pointsEarned) ? e.pointsEarned : 0,
      correct: Number.isFinite(e.correct) ? e.correct : 0,
      total: Number.isFinite(e.total) ? e.total : 0,
    }));
}
