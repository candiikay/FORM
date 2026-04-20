/** WNBA schedule via ESPN public API + muted palette mapping. */

import { isSupabaseEnabled, getSupabase } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { weekIdForDate } from './week.js';

const ESPN_WNBA_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard';

/**
 * Three hexes per team — primary / secondary / accent.
 * Sourced from official WNBA team brand guides; values nudged up in saturation
 * just enough to survive the multiply blend without losing identity.
 */
const WNBA_CURATED_PALETTES = {
  /* Liberty: seafoam, black, orange flame */
  NYL: ['#86cebc', '#000000', '#ff671f'],
  /* Fever: navy, scarlet, gold */
  IND: ['#002d62', '#e03a3e', '#fdbb30'],
  /* Aces: black, scarlet, silver */
  LVA: ['#000000', '#a6192e', '#bac3c9'],
  /* Sun: orange, navy, slate-blue */
  CON: ['#f05a28', '#0c2340', '#9eb8d4'],
  /* Lynx: navy hero, aurora teal (uniquely theirs in the palette), warm gold */
  MIN: ['#1d3a8a', '#3db89a', '#f4c542'],
  /* Mercury (2024 rebrand): deep purple, hot pink, orange */
  PHX: ['#201747', '#e56db1', '#f26649'],
  /* Storm: forest green, brand orange, yellow */
  SEA: ['#2c5234', '#fe5000', '#fec52e'],
  /* Sky: sky blue, navy, yellow */
  CHI: ['#418fde', '#020f3a', '#ffd100'],
  /* Dream: red, powder blue, black */
  ATL: ['#c8102e', '#5091cd', '#000000'],
  /* Mystics: red, navy, silver */
  WAS: ['#e03a3e', '#002b5c', '#c4ced4'],
  /* Wings: neon green, navy, orange */
  DAL: ['#c4d600', '#0c2340', '#f26649'],
  /* Sparks: Lakers purple, gold, black */
  LAS: ['#552583', '#fdb927', '#0c0c0c'],
  /* Valkyries: violet, black, gold */
  GSV: ['#5d2e8c', '#000000', '#ffc72c'],
};

/** Fallback when API is empty, offline, or CORS-blocked (open via http://localhost). */
const STATIC_SCHEDULE = [
  {
    id: 'static-0',
    home: 'Liberty',
    away: 'Fever',
    day: 'SAT',
    homeColor: '#5a7d72',
    awayColor: '#8a6a4a',
    homeColorRaw: WNBA_CURATED_PALETTES.NYL[0],
    awayColorRaw: WNBA_CURATED_PALETTES.IND[0],
    homePalette: [...WNBA_CURATED_PALETTES.NYL],
    awayPalette: [...WNBA_CURATED_PALETTES.IND],
    eventId: null,
  },
  {
    id: 'static-1',
    home: 'Aces',
    away: 'Sun',
    day: 'SUN',
    homeColor: '#6b5048',
    awayColor: '#7a5048',
    homeColorRaw: WNBA_CURATED_PALETTES.LVA[0],
    awayColorRaw: WNBA_CURATED_PALETTES.CON[0],
    homePalette: [...WNBA_CURATED_PALETTES.LVA],
    awayPalette: [...WNBA_CURATED_PALETTES.CON],
    eventId: null,
  },
  {
    id: 'static-2',
    home: 'Lynx',
    away: 'Mercury',
    day: 'MON',
    homeColor: '#3d4f68',
    awayColor: '#6a5580',
    homeColorRaw: WNBA_CURATED_PALETTES.MIN[0],
    awayColorRaw: WNBA_CURATED_PALETTES.PHX[0],
    homePalette: [...WNBA_CURATED_PALETTES.MIN],
    awayPalette: [...WNBA_CURATED_PALETTES.PHX],
    eventId: null,
  },
  {
    id: 'static-3',
    home: 'Storm',
    away: 'Sky',
    day: 'TUE',
    homeColor: '#4a5a5e',
    awayColor: '#5c5a58',
    homeColorRaw: WNBA_CURATED_PALETTES.SEA[0],
    awayColorRaw: WNBA_CURATED_PALETTES.CHI[0],
    homePalette: [...WNBA_CURATED_PALETTES.SEA],
    awayPalette: [...WNBA_CURATED_PALETTES.CHI],
    eventId: null,
  },
];

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function padRange(start, days) {
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return `${fmt(start)}-${fmt(end)}`;
}

/** Mute ESPN hex (# optional) for editorial UI. */
export function muteTeamColor(hex) {
  if (!hex || typeof hex !== 'string') return '#6b6560';
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return '#6b6560';
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  const lr = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = Math.round(r * 0.68 + lr * 0.32);
  g = Math.round(g * 0.68 + lr * 0.32);
  b = Math.round(b * 0.68 + lr * 0.32);
  const mix = 0.07;
  const cream = { r: 237, g: 232, b: 224 };
  r = Math.round(r * (1 - mix) + cream.r * mix);
  g = Math.round(g * (1 - mix) + cream.g * mix);
  b = Math.round(b * (1 - mix) + cream.b * mix);
  const out = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  return `#${out}`;
}

function hexToRgb(hex) {
  let h = String(hex || '').replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  if (Number.isNaN(num) || h.length !== 6) return { r: 107, g: 101, b: 96 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(rgb) {
  const c = (x) =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`;
}

function mixRgb(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Normalize to #rrggbb without editorial muting (canvas art). */
function normalizeTeamHex(hex) {
  if (!hex || typeof hex !== 'string') return '#6b6560';
  let h = hex.replace(/^#/, '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return '#6b6560';
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return '#6b6560';
  return `#${h.toLowerCase()}`;
}

function lightenHex(hex, t) {
  const white = { r: 255, g: 255, b: 255 };
  return rgbToHex(mixRgb(hexToRgb(hex), white, t));
}

function darkenHex(hex, t) {
  const nearBlack = { r: 18, g: 20, b: 22 };
  return rgbToHex(mixRgb(hexToRgb(hex), nearBlack, t));
}

/** Push channels away from luminance (slightly richer for canvas). */
function saturateHex(hex, amt) {
  const rgb = hexToRgb(hex);
  const lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  const out = {
    r: rgb.r + (rgb.r - lum) * amt,
    g: rgb.g + (rgb.g - lum) * amt,
    b: rgb.b + (rgb.b - lum) * amt,
  };
  return rgbToHex({
    r: Math.max(0, Math.min(255, out.r)),
    g: Math.max(0, Math.min(255, out.g)),
    b: Math.max(0, Math.min(255, out.b)),
  });
}

/** Enforce minimum RGB distance between the three slots (fixes muddy ESPN pairs). */
function spreadPaletteTriplet(p0, p1, p2, minD = 46) {
  let h0 = normalizeTeamHex(p0);
  let h1 = normalizeTeamHex(p1);
  let h2 = normalizeTeamHex(p2);
  const lum = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const apart = (a, b, darkenB) => {
    if (colorDistance(hexToRgb(a), hexToRgb(b)) >= minD) return b;
    return lum(a) > 120 ? darkenHex(a, darkenB ? 0.38 : 0.22) : lightenHex(a, 0.26);
  };
  h1 = apart(h0, h1, true);
  h2 = apart(h0, h2, false);
  if (colorDistance(hexToRgb(h1), hexToRgb(h2)) < minD) {
    h2 = saturateHex(lightenHex(h1, 0.2), 0.18);
  }
  if (colorDistance(hexToRgb(h1), hexToRgb(h2)) < minD) {
    h2 = darkenHex(h0, 0.36);
  }
  if (colorDistance(hexToRgb(h0), hexToRgb(h2)) < minD) {
    h2 = lightenHex(h0, 0.24);
  }
  return [h0, h1, h2].map(normalizeTeamHex);
}

/**
 * Three uniform-adjacent hexes from ESPN team (curated by abbreviation when available).
 * @param {object} team — competitor.team
 * @returns {[string, string, string]}
 */
export function artPaletteFromEspnTeam(team) {
  const abbr = String(team?.abbreviation || '')
    .trim()
    .toUpperCase();
  if (abbr && WNBA_CURATED_PALETTES[abbr]) {
    const [a, b, c] = WNBA_CURATED_PALETTES[abbr].map((h) => normalizeTeamHex(h));
    return spreadPaletteTriplet(a, b, c, 44);
  }

  let p0 = saturateHex(normalizeTeamHex(team?.color || '666666'), 0.1);
  let p1 = normalizeTeamHex(team?.alternateColor || '');
  const rgb0 = hexToRgb(p0);
  const rgb1 = p1 ? hexToRgb(p1) : null;
  if (!p1 || !rgb1 || colorDistance(rgb0, rgb1) < 32) {
    p1 = darkenHex(p0, 0.22);
  }
  if (colorDistance(hexToRgb(p0), hexToRgb(p1)) < 30) {
    p1 = lightenHex(p0, 0.14);
  }
  p1 = saturateHex(p1, 0.1);
  let p2 = rgbToHex(mixRgb(hexToRgb(p0), hexToRgb(p1), 0.32));
  if (colorDistance(hexToRgb(p0), hexToRgb(p2)) < 28) {
    p2 = lightenHex(p0, 0.16);
  }
  p2 = saturateHex(p2, 0.1);
  return spreadPaletteTriplet(p0, p1, p2, 44);
}

/**
 * @param {object} game
 * @param {'home' | 'away'} side
 * @returns {[string, string, string]}
 */
export function artPaletteForSide(game, side) {
  const key = side === 'home' ? 'homePalette' : 'awayPalette';
  const rawKey = side === 'home' ? 'homeColorRaw' : 'awayColorRaw';
  const fallbackHex = side === 'home' ? game?.homeColor : game?.awayColor;
  const pal = game?.[key];
  if (Array.isArray(pal) && pal.length >= 3) {
    const [a, b, c] = pal.slice(0, 3).map((h) => normalizeTeamHex(h));
    return spreadPaletteTriplet(a, b, c, 42);
  }
  if (Array.isArray(pal) && pal.length === 2) {
    const a = normalizeTeamHex(pal[0]);
    const b = normalizeTeamHex(pal[1]);
    const c = rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), 0.35));
    return spreadPaletteTriplet(a, b, c, 42);
  }
  const base = normalizeTeamHex(game?.[rawKey] || fallbackHex || '#6b6560');
  return spreadPaletteTriplet(base, lightenHex(base, 0.18), darkenHex(base, 0.26), 42);
}

/** @param {'left' | 'right'} pickDirection */
export function artPaletteForPick(game, pickDirection) {
  return artPaletteForSide(game, pickDirection === 'left' ? 'home' : 'away');
}

function parseEspnEvents(data) {
  const events = data?.events;
  if (!Array.isArray(events) || events.length === 0) return [];

  const games = [];
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    const teams = comp?.competitors;
    if (!teams || teams.length < 2) continue;

    const home = teams.find((c) => c.homeAway === 'home');
    const away = teams.find((c) => c.homeAway === 'away');
    if (!home?.team || !away?.team) continue;

    /** Skip exhibition guests (e.g. national teams) — ESPN omits WNBA-style abbrev for those. */
    const ab = (t) => String(t?.abbreviation || '').trim();
    if (!ab(home.team) || !ab(away.team)) continue;

    const d = new Date(comp.date || ev.date);
    const day = DAY_NAMES[d.getUTCDay()];

    const homeColor = muteTeamColor(home.team.color || '888888');
    const awayColor = muteTeamColor(away.team.color || '888888');
    const homePalette = artPaletteFromEspnTeam(home.team);
    const awayPalette = artPaletteFromEspnTeam(away.team);
    const homeColorRaw = normalizeTeamHex(home.team.color || '888888');
    const awayColorRaw = normalizeTeamHex(away.team.color || '888888');

    games.push({
      id: String(ev.id),
      eventId: ev.id,
      home: home.team.shortDisplayName || home.team.name,
      away: away.team.shortDisplayName || away.team.name,
      day,
      homeColor,
      awayColor,
      homeColorRaw,
      awayColorRaw,
      homePalette,
      awayPalette,
      startTime: comp.date || ev.date,
    });
  }

  games.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  return games;
}

export async function fetchSchedule() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 1);
  const ranges = [
    padRange(start, 10),
    padRange(new Date(start.getTime() + 11 * 86400000), 14),
  ];

  for (const dates of ranges) {
    const url = `${ESPN_WNBA_SCOREBOARD}?dates=${dates}&limit=100`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const games = parseEspnEvents(data);
      if (games.length > 0) return games;
    } catch {
      /* network / CORS */
    }
  }

  return STATIC_SCHEDULE;
}

/**
 * Persist a week's picks.
 *
 * `payload.picks` is an object keyed by gameId → { pick: 'left' | 'right' }.
 * In dev / demo mode the call simply caches the payload to localStorage so
 * the rest of the app can read it back. When Supabase is configured the
 * picks are upserted into the `picks` table — one row per (user, week, game)
 * — keyed off the auth user's id and the current week_id.
 */
export async function submitPicks(payload) {
  const body = JSON.stringify(payload);
  try {
    localStorage.setItem('form_last_set', body);
  } catch {
    /* quota */
  }

  if (!isSupabaseEnabled()) return { ok: true, payload, persisted: 'local' };

  const sb = await getSupabase();
  if (!sb) return { ok: true, payload, persisted: 'local' };

  const user = getCurrentUser();
  if (!user?.userId) {
    return { ok: true, payload, persisted: 'local', reason: 'guest' };
  }

  const weekId = payload.weekId || weekIdForDate(new Date());
  const picks = payload.picks || {};
  const rows = Object.entries(picks)
    .map(([gameId, info]) => ({
      user_id: user.userId,
      week_id: weekId,
      game_id: String(gameId),
      pick: info?.pick === 'right' ? 'right' : 'left',
    }))
    .filter((r) => r.pick === 'left' || r.pick === 'right');

  if (rows.length === 0) return { ok: true, payload, persisted: 'local' };

  const { error } = await sb
    .from('picks')
    .upsert(rows, { onConflict: 'user_id,week_id,game_id' });

  if (error) {
    console.warn('[api] submitPicks supabase error', error);
    return { ok: true, payload, persisted: 'local', reason: error.message };
  }
  return { ok: true, payload, persisted: 'remote', count: rows.length };
}

/**
 * Read picks for the current week from the database, keyed by game_id.
 * Used by the You / Picks pages to rehydrate state on a fresh device.
 */
export async function fetchMyPicksForWeek(weekId) {
  if (!isSupabaseEnabled()) return null;
  const sb = await getSupabase();
  if (!sb) return null;
  const user = getCurrentUser();
  if (!user?.userId) return null;
  const wk = weekId || weekIdForDate(new Date());
  const { data, error } = await sb
    .from('picks')
    .select('game_id, pick, created_at')
    .eq('user_id', user.userId)
    .eq('week_id', wk);
  if (error) {
    console.warn('[api] fetchMyPicksForWeek error', error);
    return null;
  }
  const out = {};
  (data || []).forEach((r) => {
    out[r.game_id] = { pick: r.pick, lockedAt: r.created_at };
  });
  return out;
}
