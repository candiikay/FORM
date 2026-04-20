/**
 * Leaderboard.
 *
 * Two scopes are supported and cached separately in localStorage:
 *   - season: cumulative since week 1 (rendered by default before realtime)
 *   - weekly: just this `week_id` (more dynamic, drives the default Wall view)
 *
 * Each `getXSnapshot()` is synchronous and returns the cached local board so
 * the page can render instantly. When Supabase is enabled, the matching
 * `refreshXLeaderboard()` pulls live data, caches it back, and resolves with
 * the new snapshot. Pages can call refresh after first paint to upgrade in
 * place without flashing an empty list.
 */

import { isSupabaseEnabled, getSupabase } from './supabase.js';

const LS_BOARD = 'form_leaderboard_v1';
const LS_WEEKLY_PREFIX = 'form_leaderboard_week_';

function loadBoard() {
  try {
    const raw = localStorage.getItem(LS_BOARD);
    if (!raw) return defaultBoard();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : defaultBoard();
  } catch {
    return defaultBoard();
  }
}

function defaultBoard() {
  return [
    { name: 'Avery',  pts: 142, streak: 5 },
    { name: 'Imani',  pts: 128, streak: 4 },
    { name: 'Sloane', pts: 121, streak: 6 },
    { name: 'Maya',   pts: 110, streak: 3 },
    { name: 'Nia',    pts:  98, streak: 4 },
    { name: 'Camila', pts:  87, streak: 2 },
    { name: 'Jules',  pts:  79, streak: 3 },
    { name: 'Reese',  pts:  68, streak: 2 },
    { name: 'Tomi',   pts:  54, streak: 1 },
    { name: 'Kit',    pts:  41, streak: 1 },
  ];
}

function writeBoard(rows) {
  try {
    localStorage.setItem(LS_BOARD, JSON.stringify(rows.slice(0, 24)));
  } catch {
    /* ignore */
  }
}

function weeklyKey(weekId) {
  return `${LS_WEEKLY_PREFIX}${weekId}`;
}

function loadWeeklyBoard(weekId) {
  if (!weekId) return [];
  try {
    const raw = localStorage.getItem(weeklyKey(weekId));
    if (!raw) return defaultWeeklyBoard(weekId);
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : defaultWeeklyBoard(weekId);
  } catch {
    return defaultWeeklyBoard(weekId);
  }
}

function writeWeeklyBoard(weekId, rows) {
  if (!weekId) return;
  try {
    localStorage.setItem(weeklyKey(weekId), JSON.stringify(rows.slice(0, 24)));
  } catch {
    /* ignore */
  }
}

// Hash-based scramble of the season mock so the demo "this week" board feels
// distinct from the season ordering without inventing new names. Real users
// always overwrite this once Supabase returns rows.
function defaultWeeklyBoard(weekId) {
  const season = defaultBoard();
  const seed = hashStr(String(weekId || 'static-week'));
  return season
    .map((row, i) => {
      const r = mulberry32(seed + i * 7919);
      const wkPts = Math.round(20 + r() * 65);
      return { name: row.name, pts: wkPts, streak: row.streak };
    })
    .sort((a, b) => b.pts - a.pts);
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (((x ^ (x >>> 14)) >>> 0) % 10000) / 10000;
  };
}

export function getLeaderboardSnapshot() {
  return loadBoard().slice().sort((a, b) => b.pts - a.pts);
}

export function getWeeklyLeaderboardSnapshot(weekId) {
  return loadWeeklyBoard(weekId).slice().sort((a, b) => b.pts - a.pts);
}

export function mergeUserIntoLeaderboard(name, pts, streak) {
  if (!name) return;
  const rows = loadBoard().filter((r) => r.name.toLowerCase() !== name.toLowerCase());
  rows.push({ name, pts, streak });
  rows.sort((a, b) => b.pts - a.pts);
  writeBoard(rows.slice(0, 12));
}

export function mergeUserIntoWeeklyLeaderboard(weekId, name, pts, streak) {
  if (!name || !weekId) return;
  const rows = loadWeeklyBoard(weekId).filter(
    (r) => r.name.toLowerCase() !== name.toLowerCase(),
  );
  rows.push({ name, pts, streak });
  rows.sort((a, b) => b.pts - a.pts);
  writeWeeklyBoard(weekId, rows.slice(0, 12));
}

/**
 * Pull live season standings from Supabase. Resolves with the rebuilt
 * snapshot, or the local snapshot when Supabase isn't configured / the query
 * fails.
 */
export async function refreshLeaderboard() {
  if (!isSupabaseEnabled()) return getLeaderboardSnapshot();
  const sb = await getSupabase();
  if (!sb) return getLeaderboardSnapshot();
  try {
    const { data, error } = await sb
      .from('leaderboard')
      .select('display_name, points, scored_weeks')
      .order('points', { ascending: false })
      .limit(50);
    if (error || !Array.isArray(data)) return getLeaderboardSnapshot();
    const rows = data
      .filter((r) => r.display_name)
      .map((r) => ({
        name: r.display_name,
        pts: Number(r.points) || 0,
        streak: Number(r.scored_weeks) || 0,
      }));
    if (rows.length) writeBoard(rows);
    return rows.slice().sort((a, b) => b.pts - a.pts);
  } catch (err) {
    console.warn('[leaderboard] refresh failed', err);
    return getLeaderboardSnapshot();
  }
}

/* ── Arbitrary date-range leaderboard ────────────────────────────
 *
 * Lets the UI pull standings for any window — last 30 days, last
 * season, all time, custom range. Aggregates at the **game grain**
 * (each picker scored on individual games over the window), not by
 * week. In demo mode (no Supabase), the board is deterministically
 * synthesized from the season mock so the same range always yields
 * the same shape. With Supabase configured, calls a `range_leaderboard`
 * RPC if available; otherwise falls back to season totals as a
 * conservative approximation.
 *
 * Range shape:  { start: Date|string, end: Date|string }
 */

function dayMs(d) {
  return Math.floor(new Date(d).getTime() / 86400000);
}

function rangeDays(range) {
  const s = dayMs(range.start);
  const e = dayMs(range.end);
  return Math.max(1, e - s + 1);
}

function rangeKey(range) {
  const s = new Date(range.start).toISOString().slice(0, 10);
  const e = new Date(range.end).toISOString().slice(0, 10);
  return `${s}__${e}`;
}

/** Rough WNBA cadence: about 5 games per day league-wide during the
 *  regular season. Caps so a multi-year range stays renderable. */
export function estimateGamesInRange(range) {
  const days = rangeDays(range);
  return Math.min(420, Math.max(1, Math.round(days * 5.4)));
}

/** Number of trail ticks to draw — sub-sampled for big ranges so the
 *  curve stays readable. Each tick still represents real games. */
export function trailTickCount(range) {
  const games = estimateGamesInRange(range);
  if (games <= 18) return games;
  if (games <= 60) return Math.round(games / 2);
  return Math.min(40, Math.max(18, Math.round(games / 6)));
}

export function getRangeLeaderboardSnapshot(range) {
  const seasonRows = loadBoard();
  const seed = hashStr(`${rangeKey(range)}|range`);
  const games = estimateGamesInRange(range);
  return seasonRows
    .map((row, i) => {
      const r = mulberry32(seed + i * 7919);
      const hitRate = 0.34 + r() * 0.42; // 34–76%
      const hits = Math.round(games * hitRate);
      const perfectBonus = r() < 0.18 ? Math.max(0, Math.floor(games / 9)) * 5 : 0;
      const pts = hits * 10 + perfectBonus;
      const gameStreak = Math.max(0, Math.round(r() * Math.min(12, games / 4)));
      return {
        name: row.name,
        pts,
        streak: gameStreak,        // game-streak (not week-streak) for this range
        hits,
        scored: games,             // games available in the range
        games,
      };
    })
    .sort((a, b) => b.pts - a.pts);
}

/** Merge the signed-in user into a range board (in-memory; nothing
 *  cached because ranges are arbitrary). The caller passes the user's
 *  current pts/hits/games for the range — for the demo path that's
 *  whatever local state has, scaled to the range size. */
export function mergeUserIntoRangeBoard(board, name, pts, hits, scored) {
  if (!name) return board;
  const lower = name.toLowerCase();
  const filtered = board.filter((r) => r.name.toLowerCase() !== lower);
  filtered.push({
    name,
    pts: Number(pts) || 0,
    streak: 0,
    hits: Number(hits) || 0,
    scored: Number(scored) || 0,
    games: Number(scored) || 0,
  });
  filtered.sort((a, b) => b.pts - a.pts);
  return filtered;
}

/**
 * Pull range standings from Supabase. Tries an RPC named
 * `range_leaderboard(start_date, end_date)` first (recommended — see
 * `supabase/migrations/0004_range_leaderboard.sql` once added), then
 * falls back to the season totals so the UI still upgrades from the
 * demo board to real users on any failure.
 */
export async function refreshRangeLeaderboard(range) {
  if (!isSupabaseEnabled()) return getRangeLeaderboardSnapshot(range);
  const sb = await getSupabase();
  if (!sb) return getRangeLeaderboardSnapshot(range);
  const startISO = new Date(range.start).toISOString().slice(0, 10);
  const endISO = new Date(range.end).toISOString().slice(0, 10);
  try {
    const { data, error } = await sb.rpc('range_leaderboard', {
      start_date: startISO,
      end_date: endISO,
    });
    if (!error && Array.isArray(data) && data.length) {
      return data
        .filter((r) => r.display_name)
        .map((r) => ({
          name: r.display_name,
          pts: Number(r.points) || 0,
          streak: Number(r.game_streak) || 0,
          hits: Number(r.total_hits) || 0,
          scored: Number(r.scored_games) || 0,
          games: Number(r.scored_games) || 0,
        }))
        .sort((a, b) => b.pts - a.pts);
    }
  } catch (err) {
    console.warn('[leaderboard] range RPC unavailable, falling back', err);
  }
  // Fallback: season leaderboard (RPC not deployed yet)
  return refreshLeaderboard();
}

/**
 * Pull this-week standings from Supabase's `weekly_leaderboard` view. Falls
 * back to the cached/mocked snapshot on any failure so the UI never empties.
 */
export async function refreshWeeklyLeaderboard(weekId) {
  if (!weekId) return [];
  if (!isSupabaseEnabled()) return getWeeklyLeaderboardSnapshot(weekId);
  const sb = await getSupabase();
  if (!sb) return getWeeklyLeaderboardSnapshot(weekId);
  try {
    const { data, error } = await sb
      .from('weekly_leaderboard')
      .select('display_name, points, total_hits, scored_picks')
      .eq('week_id', weekId)
      .order('points', { ascending: false })
      .limit(50);
    if (error || !Array.isArray(data)) return getWeeklyLeaderboardSnapshot(weekId);
    const rows = data
      .filter((r) => r.display_name)
      .map((r) => ({
        name: r.display_name,
        pts: Number(r.points) || 0,
        // For weekly view, "streak" slot doubles as scored picks this week so
        // the chip can read "3/5 graded" instead of an irrelevant season streak.
        streak: 0,
        hits: Number(r.total_hits) || 0,
        scored: Number(r.scored_picks) || 0,
      }));
    if (rows.length) writeWeeklyBoard(weekId, rows);
    return rows.slice().sort((a, b) => b.pts - a.pts);
  } catch (err) {
    console.warn('[leaderboard] weekly refresh failed', err);
    return getWeeklyLeaderboardSnapshot(weekId);
  }
}
