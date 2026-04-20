/** Wall posts — per-person "lock-in" cards for the current week.
 *
 * In demo mode (no Supabase) we generate a deterministic pool of named
 * pickers with seeded picks for the current schedule, plus a synthetic
 * "locked at" timestamp distributed across the week. With Supabase
 * configured, we fetch real picks for this week, join to profiles for
 * display names, and pull season points from the leaderboard view.
 *
 * Each post:
 *   {
 *     id:          string
 *     name:        string                          // display name
 *     picks:       { [gameId: string]: 'left'|'right' }
 *     lockedAtMs:  number                          // unix ms of latest pick
 *     pts:         number                          // season points so far
 *     streak:      number                          // active correct-week streak
 *     source:      'mock' | 'remote'
 *   }
 *
 * Posts are returned newest-first.
 */

import { isSupabaseEnabled, getSupabase } from './supabase.js';
import { weekIdForDate, currentWeekLabel } from './week.js';

const MOCK_NAMES = [
  'Jordan', 'Frankie', 'Sam', 'Riley', 'Quincy', 'Blair',
  'Cyd', 'Etta', 'Kai', 'Sloan', 'Win', 'Iris', 'Wes', 'Rae',
];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function makeMockPosts(games, weekLabel) {
  if (!games?.length) return [];
  const weekSeed = hashStr(`${weekLabel}|posts`);
  const now = Date.now();
  const out = [];
  MOCK_NAMES.forEach((name, idx) => {
    const r = seededRandom(weekSeed ^ hashStr(name));
    const picks = {};
    for (const g of games) {
      picks[g.id] = r() < 0.5 ? 'left' : 'right';
    }
    const hoursAgo = Math.floor(r() * 168);
    const lockedAtMs = now - hoursAgo * 3600 * 1000;
    const pts = Math.round(8 + r() * 38);
    const streak = Math.floor(r() * 5);
    out.push({
      id: `mock-${idx}-${name}`,
      name,
      picks,
      lockedAtMs,
      pts,
      streak,
      source: 'mock',
    });
  });
  out.sort((a, b) => b.lockedAtMs - a.lockedAtMs);
  return out;
}

async function fetchRealPosts(games) {
  if (!isSupabaseEnabled() || !games?.length) return null;
  const sb = await getSupabase();
  if (!sb) return null;
  const weekId = weekIdForDate(new Date());
  const ids = games.map((g) => String(g.id));
  try {
    const { data: picks, error: pErr } = await sb
      .from('picks')
      .select('user_id, game_id, pick, created_at')
      .eq('week_id', weekId)
      .in('game_id', ids);
    if (pErr || !Array.isArray(picks) || picks.length === 0) return null;

    const userIds = [...new Set(picks.map((p) => p.user_id))];
    if (userIds.length === 0) return null;

    const { data: profiles } = await sb
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);
    const nameByUser = Object.create(null);
    if (Array.isArray(profiles)) {
      for (const p of profiles) {
        if (p.display_name) nameByUser[p.user_id] = p.display_name;
      }
    }

    const ptsByName = Object.create(null);
    try {
      const { data: lb } = await sb
        .from('leaderboard')
        .select('display_name, points');
      if (Array.isArray(lb)) {
        for (const r of lb) {
          if (r.display_name) ptsByName[r.display_name.toLowerCase()] = Number(r.points) || 0;
        }
      }
    } catch { /* ignore */ }

    const byUser = Object.create(null);
    for (const row of picks) {
      const u = row.user_id;
      if (!byUser[u]) {
        byUser[u] = {
          id: `real-${u}`,
          name: nameByUser[u] || 'Anonymous',
          picks: {},
          lockedAtMs: 0,
          pts: 0,
          streak: 0,
          source: 'remote',
        };
      }
      byUser[u].picks[row.game_id] = row.pick === 'right' ? 'right' : 'left';
      const t = new Date(row.created_at).getTime();
      if (Number.isFinite(t) && t > byUser[u].lockedAtMs) byUser[u].lockedAtMs = t;
    }

    const out = Object.values(byUser);
    for (const post of out) {
      post.pts = ptsByName[post.name.toLowerCase()] || 0;
    }
    out.sort((a, b) => b.lockedAtMs - a.lockedAtMs);
    return out;
  } catch (err) {
    console.warn('[wall-posts] real fetch failed', err);
    return null;
  }
}

export async function loadPosts(games) {
  const real = await fetchRealPosts(games);
  if (real && real.length > 0) return { posts: real, source: 'remote' };
  const mock = makeMockPosts(games, currentWeekLabel());
  return { posts: mock, source: 'mock' };
}

/** Friendly "5m ago" / "3h ago" / "2d ago" / "1w ago". */
export function timeAgo(ms) {
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Build a per-user weekly points sparkline from the leaderboard.
 *  Mock by default — gives every name a deterministic 6-point arc.
 */
export function pointsSparkline(name, length = 6) {
  const seed = hashStr(`${name}|spark`);
  const r = seededRandom(seed);
  const out = [];
  let acc = 0;
  for (let i = 0; i < length; i++) {
    acc += Math.round(r() * 12) - 2;
    if (acc < 0) acc = 0;
    out.push(acc);
  }
  return out;
}
