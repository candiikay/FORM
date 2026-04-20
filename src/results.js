/**
 * Per-game results, keyed by game.id → 'left' | 'right'.
 *
 * Synchronous reads are served from a localStorage cache (the demo path).
 * When Supabase is configured, `refreshResults()` pulls the live `results`
 * table into the same cache so subsequent synchronous reads see the truth.
 *
 *   getResults() : Record<gameId, 'left' | 'right'>
 *   getResult(gameId) : 'left' | 'right' | null
 *   refreshResults() : Promise<Record<gameId, 'left' | 'right'>>
 */

import { isSupabaseEnabled, getSupabase } from './supabase.js';

const LS_RESULTS = 'form_results_v1';

function readMap() {
  try {
    const raw = localStorage.getItem(LS_RESULTS);
    if (!raw) return Object.create(null);
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj;
  } catch {
    /* invalid */
  }
  return Object.create(null);
}

function writeMap(map) {
  try {
    localStorage.setItem(LS_RESULTS, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getResults() {
  return { ...readMap() };
}

export function getResult(gameId) {
  const map = readMap();
  const v = map[String(gameId)];
  return v === 'left' || v === 'right' ? v : null;
}

/**
 * Set a single result. Pass null to clear.
 * Used by demo / admin tooling.
 */
export function setResult(gameId, winner) {
  const map = readMap();
  if (winner === 'left' || winner === 'right') {
    map[String(gameId)] = winner;
  } else {
    delete map[String(gameId)];
  }
  writeMap(map);
}

export function setResults(map) {
  if (!map || typeof map !== 'object') return;
  const clean = Object.create(null);
  for (const [k, v] of Object.entries(map)) {
    if (v === 'left' || v === 'right') clean[String(k)] = v;
  }
  writeMap(clean);
}

export function clearResults() {
  try {
    localStorage.removeItem(LS_RESULTS);
  } catch {
    /* ignore */
  }
}

/**
 * Pull live results from Supabase (when configured), cache locally, and
 * return the merged map. Safe to call from any page after first paint.
 */
export async function refreshResults() {
  if (!isSupabaseEnabled()) return getResults();
  const sb = await getSupabase();
  if (!sb) return getResults();
  try {
    const { data, error } = await sb
      .from('results')
      .select('game_id, winner');
    if (error || !Array.isArray(data)) return getResults();
    const map = readMap();
    data.forEach((r) => {
      if (r.winner === 'left' || r.winner === 'right') {
        map[String(r.game_id)] = r.winner;
      }
    });
    writeMap(map);
    return { ...map };
  } catch (err) {
    console.warn('[results] refresh failed', err);
    return getResults();
  }
}
