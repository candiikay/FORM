/**
 * Atlas data layer — WNBA teams, schedules, rosters, and per-game leaders,
 * pulled from ESPN's public web APIs. The Atlas maker is a 3-step wizard
 * (team → game → player), so this module exposes three fetchers:
 *
 *   1. Team catalog    — static, ships with the bundle. Includes each
 *                        franchise's ESPN team id, display name, and a
 *                        curated 3-color brand palette used by the
 *                        watercolor painter (same system the pick-em
 *                        cards use).
 *   2. fetchTeamSchedule(abbrev)  — recent finished games for a team,
 *                                   newest first. Falls back to the
 *                                   previous season if the current one
 *                                   hasn't started yet.
 *   3. fetchGameRoster(gameId)    — full boxscore for one game, split
 *                                   into home/away rosters with per-
 *                                   player points / rebounds / assists.
 *
 * Network failures resolve to `[]` / `null` so callers can render an
 * empty state instead of crashing.
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';

/* ── team catalog ───────────────────────────────────────────────────── */

/**
 * Curated 3-color palettes, lifted from the same `WNBA_CURATED_PALETTES`
 * table the pick-em cards use. Order is meaningful — `drawInkWashField`
 * reads [c0, c1, c2] as cool / warm / deep.
 */
export const WNBA_TEAMS = [
  {
    abbrev: 'ATL',
    name: 'Atlanta Dream',
    short: 'Dream',
    espnId: '20',
    accent: '#C8102E',
    palette: ['#c8102e', '#5091cd', '#000000'],
  },
  {
    abbrev: 'CHI',
    name: 'Chicago Sky',
    short: 'Sky',
    espnId: '19',
    accent: '#418FDE',
    palette: ['#418fde', '#020f3a', '#ffd100'],
  },
  {
    abbrev: 'CONN',
    name: 'Connecticut Sun',
    short: 'Sun',
    espnId: '18',
    accent: '#F05A28',
    palette: ['#f05a28', '#0c2340', '#9eb8d4'],
  },
  {
    abbrev: 'DAL',
    name: 'Dallas Wings',
    short: 'Wings',
    espnId: '3',
    accent: '#C4D600',
    palette: ['#c4d600', '#0c2340', '#f26649'],
  },
  {
    abbrev: 'GSV',
    name: 'Golden State Valkyries',
    short: 'Valkyries',
    espnId: '129689',
    accent: '#5D2E8C',
    palette: ['#5d2e8c', '#000000', '#ffc72c'],
  },
  {
    abbrev: 'IND',
    name: 'Indiana Fever',
    short: 'Fever',
    espnId: '5',
    accent: '#002D62',
    palette: ['#002d62', '#e03a3e', '#fdbb30'],
  },
  {
    abbrev: 'LV',
    name: 'Las Vegas Aces',
    short: 'Aces',
    espnId: '17',
    accent: '#000000',
    palette: ['#000000', '#a6192e', '#bac3c9'],
  },
  {
    abbrev: 'LA',
    name: 'Los Angeles Sparks',
    short: 'Sparks',
    espnId: '6',
    accent: '#552583',
    palette: ['#552583', '#fdb927', '#0c0c0c'],
  },
  {
    abbrev: 'MIN',
    name: 'Minnesota Lynx',
    short: 'Lynx',
    espnId: '8',
    accent: '#1D3A8A',
    palette: ['#1d3a8a', '#3db89a', '#f4c542'],
  },
  {
    abbrev: 'NY',
    name: 'New York Liberty',
    short: 'Liberty',
    espnId: '9',
    accent: '#86CEBC',
    palette: ['#86cebc', '#000000', '#ff671f'],
  },
  {
    abbrev: 'PHX',
    name: 'Phoenix Mercury',
    short: 'Mercury',
    espnId: '11',
    accent: '#201747',
    palette: ['#201747', '#e56db1', '#f26649'],
  },
  {
    abbrev: 'SEA',
    name: 'Seattle Storm',
    short: 'Storm',
    espnId: '14',
    accent: '#2C5234',
    palette: ['#2c5234', '#fe5000', '#fec52e'],
  },
  {
    abbrev: 'WSH',
    name: 'Washington Mystics',
    short: 'Mystics',
    espnId: '16',
    accent: '#E03A3E',
    palette: ['#e03a3e', '#002b5c', '#c4ced4'],
  },
];

/**
 * The three stat categories that a player card always displays.
 * Order = reading order across the painting (top → bottom bands).
 */
export const STAT_CATEGORIES = [
  { id: 'points',   label: 'Points',    short: 'PTS' },
  { id: 'rebounds', label: 'Rebounds',  short: 'REB' },
  { id: 'assists',  label: 'Assists',   short: 'AST' },
];

export function getTeam(abbrev) {
  if (!abbrev) return null;
  const key = String(abbrev).toUpperCase();
  return WNBA_TEAMS.find((t) => t.abbrev === key) || null;
}

/** Resolve a team by ESPN's numeric id — a safety net for endpoints
 *  whose `abbreviation` drifts between "NY"/"NYL", "WAS"/"WSH", etc. */
export function getTeamByEspnId(id) {
  if (!id) return null;
  const key = String(id);
  return WNBA_TEAMS.find((t) => String(t.espnId) === key) || null;
}

/** Best-effort lookup — tries abbrev first, then ESPN id. */
function resolveTeamFromEspn(teamObj) {
  const byAbbrev = getTeam(teamObj?.abbreviation);
  if (byAbbrev) return byAbbrev;
  const byId = getTeamByEspnId(teamObj?.id);
  if (byId) return byId;
  return null;
}

/* ── schedule ──────────────────────────────────────────────────────── */

/**
 * Return a team's finished games, newest-first. Tries the current year
 * first; if that season hasn't produced any played games yet, falls back
 * one year. WNBA stores schedules by `season=YYYY`.
 *
 * Shape (per game):
 *   { id, date, dateLabel, opponent: {abbrev, name, short, accent, palette},
 *     isHome, teamScore, oppScore, result: 'W'|'L' }
 */
export async function fetchTeamSchedule(teamAbbrev, opts = {}) {
  const team = getTeam(teamAbbrev);
  if (!team) return [];
  const now = opts.now instanceof Date ? opts.now : new Date();
  const thisYear = now.getUTCFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];

  for (const season of years) {
    const games = await fetchScheduleYear(team, season);
    if (games.length) return games;
  }
  return [];
}

async function fetchScheduleYear(team, season) {
  const url = `${ESPN_BASE}/teams/${encodeURIComponent(team.espnId)}/schedule?season=${season}`;
  let data = null;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const events = Array.isArray(data?.events) ? data.events : [];
  const out = [];
  for (const ev of events) {
    const parsed = parseScheduleEvent(ev, team);
    if (parsed) out.push(parsed);
  }
  out.sort((a, b) => b.date.getTime() - a.date.getTime());
  return out;
}

function parseScheduleEvent(ev, team) {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const state = comp.status?.type?.state || ev.status?.type?.state || '';
  // We only surface finished games — pre/in-progress don't have final leaders.
  if (state !== 'post') return null;
  const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
  if (competitors.length < 2) return null;

  const us = competitors.find((c) => matchesTeam(c, team));
  const them = competitors.find((c) => !matchesTeam(c, team));
  if (!us || !them) return null;

  const resolvedOpp = resolveTeamFromEspn(them.team);
  const opponent = resolvedOpp || {
    abbrev: String(them.team?.abbreviation || '').toUpperCase(),
    name: them.team?.displayName || them.team?.shortDisplayName || '',
    short: them.team?.shortDisplayName || them.team?.abbreviation || '',
    accent: `#${String(them.team?.color || '6b6560').replace(/^#/, '')}`,
    palette: null,
  };

  const date = new Date(comp.date || ev.date);
  return {
    id: String(ev.id),
    date,
    dateLabel: formatShortDate(date),
    opponent,
    isHome: us.homeAway === 'home',
    teamScore: Number(us.score) || 0,
    oppScore: Number(them.score) || 0,
    result: us.winner ? 'W' : them.winner ? 'L' : '\u2014',
  };
}

function matchesTeam(competitor, team) {
  const abbrev = String(competitor?.team?.abbreviation || '').toUpperCase();
  if (abbrev && abbrev === team.abbrev) return true;
  const cid = String(competitor?.team?.id || '');
  return cid && cid === String(team.espnId);
}

/* ── roster + boxscore ────────────────────────────────────────────── */

/**
 * Fetch the full boxscore for one game and split it into `{home, away}`
 * rosters. Each roster's `players` array is sorted by points descending
 * so the wizard's player list leads with the scoreboard name.
 *
 * Returns `null` on any network failure or malformed payload.
 */
export async function fetchGameRoster(gameId) {
  if (!gameId) return null;
  const url = `${ESPN_BASE}/summary?event=${encodeURIComponent(gameId)}`;
  let data = null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    data = await res.json();
  } catch {
    return null;
  }

  const teams = Array.isArray(data?.boxscore?.players) ? data.boxscore.players : [];
  if (!teams.length) return null;

  const rosters = teams.map(parseTeamRoster).filter(Boolean);
  if (!rosters.length) return null;

  const home = rosters.find((r) => r.homeAway === 'home') || rosters[0];
  const away = rosters.find((r) => r.homeAway === 'away') || rosters[1] || rosters[0];

  return {
    gameId: String(gameId),
    home,
    away,
  };
}

function parseTeamRoster(entry) {
  if (!entry?.team) return null;
  const brand = resolveTeamFromEspn(entry.team);
  const abbrev = (brand?.abbrev || entry.team?.abbreviation || '').toString().toUpperCase();
  const stats = Array.isArray(entry.statistics) ? entry.statistics : [];
  // ESPN returns a single "statistics" group for basketball; the group
  // contains a `names` order and per-athlete `stats` in matching order.
  const group = stats[0];
  const order = Array.isArray(group?.names) ? group.names.map((n) => String(n).toUpperCase()) : [];
  const athletes = Array.isArray(group?.athletes) ? group.athletes : [];
  const idx = {
    PTS: order.indexOf('PTS'),
    REB: order.indexOf('REB'),
    AST: order.indexOf('AST'),
    MIN: order.indexOf('MIN'),
    FG: order.indexOf('FG'),
    '3PT': order.indexOf('3PT'),
  };

  const players = [];
  for (const a of athletes) {
    if (a?.didNotPlay) continue;
    const ath = a.athlete || {};
    const values = Array.isArray(a.stats) ? a.stats : [];
    const pts = statNumber(values, idx.PTS);
    const reb = statNumber(values, idx.REB);
    const ast = statNumber(values, idx.AST);
    if (pts + reb + ast === 0 && statNumber(values, idx.MIN) === 0) continue;
    players.push({
      id: String(ath.id || ath.uid || ath.displayName || Math.random()),
      name: ath.displayName || ath.shortName || '',
      shortName: ath.shortName || ath.displayName || '',
      position: ath.position?.abbreviation || '',
      headshot: ath.headshot?.href || '',
      pts,
      reb,
      ast,
      minutes: values[idx.MIN] || '',
      fg: values[idx.FG] || '',
      threes: values[idx['3PT']] || '',
    });
  }

  players.sort((a, b) => b.pts - a.pts || b.reb - a.reb || b.ast - a.ast);

  return {
    homeAway: entry.homeAway || '',
    abbrev,
    name: brand?.name || entry.team?.displayName || abbrev,
    short: brand?.short || entry.team?.shortDisplayName || abbrev,
    accent: brand?.accent || `#${String(entry.team?.color || '6b6560').replace(/^#/, '')}`,
    palette: brand?.palette || null,
    players,
  };
}

function statNumber(values, idx) {
  if (idx < 0) return 0;
  const raw = values[idx];
  if (raw == null) return 0;
  // "14" → 14. "3-8" (FG) → 0 (we don't numeric-extract those here).
  const n = Number(String(raw).split('-')[0]);
  return Number.isFinite(n) ? n : 0;
}

/* ── formatting helpers ────────────────────────────────────────────── */

export function formatShortDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatLongDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
