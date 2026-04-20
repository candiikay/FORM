/** Schedule, picks, lightweight engagement counters, weekly archive. */

let games = [];
const picks = Object.create(null);

const STREAK_KEY = 'form_streak_days';
const POINTS_KEY = 'form_points';
const HISTORY_KEY = 'form_history_v1';

export function initSchedule(schedule) {
  games = schedule.slice();
  for (const k of Object.keys(picks)) delete picks[k];
}

export function getGames() {
  return games;
}

export function setPick(gameId, direction) {
  picks[gameId] = direction;
}

export function getPicks() {
  return { ...picks };
}

export function isFormComplete() {
  return games.length > 0 && Object.keys(picks).length >= games.length;
}

export function getStreakDays() {
  try {
    const v = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
    return Number.isFinite(v) ? Math.min(v, 99) : 0;
  } catch {
    return 0;
  }
}

export function bumpStreakOnSet() {
  try {
    const n = getStreakDays() + 1;
    localStorage.setItem(STREAK_KEY, String(n));
  } catch {
    /* ignore */
  }
}

export function getPoints() {
  try {
    const v = parseInt(localStorage.getItem(POINTS_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function addPoints(delta) {
  try {
    const next = Math.max(0, getPoints() + delta);
    localStorage.setItem(POINTS_KEY, String(next));
  } catch {
    /* ignore */
  }
}

/**
 * Snapshot the current locked-in form into the persistent history.
 * Stored as an array of weekly entries; newest first.
 *
 * Entries replace any prior entry sharing the same weekLabel so users
 * can re-lock during the week without bloating history.
 */
export function archiveCurrentForm(entry) {
  if (!entry || typeof entry !== 'object') return;
  try {
    const existing = readHistory();
    const filtered = existing.filter((e) => e.weekLabel !== entry.weekLabel);
    const snapshot = {
      weekLabel: String(entry.weekLabel || ''),
      lockedAt: entry.lockedAt || new Date().toISOString(),
      games: Array.isArray(entry.games)
        ? entry.games.map((g) => ({
            id: g.id,
            home: g.home,
            away: g.away,
            day: g.day,
            homeColor: g.homeColor,
            awayColor: g.awayColor,
            homeColorRaw: g.homeColorRaw,
            awayColorRaw: g.awayColorRaw,
            homePalette: g.homePalette,
            awayPalette: g.awayPalette,
            startTime: g.startTime,
          }))
        : [],
      picks: { ...(entry.picks || {}) },
      results: { ...(entry.results || {}) },
      pointsEarned: Number.isFinite(entry.pointsEarned) ? entry.pointsEarned : 0,
      correct: Number.isFinite(entry.correct) ? entry.correct : 0,
      total: Number.isFinite(entry.total) ? entry.total : 0,
      pending: Number.isFinite(entry.pending) ? entry.pending : 0,
    };
    const next = [snapshot, ...filtered].slice(0, 52);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* quota or invalid */
  }
}

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getHistory() {
  return readHistory();
}

export function getHistoryEntry(weekLabel) {
  return readHistory().find((e) => e.weekLabel === weekLabel) || null;
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
