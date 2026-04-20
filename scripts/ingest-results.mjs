#!/usr/bin/env node
/**
 * Pull completed games from the ESPN WNBA scoreboard and upsert each one's
 * winner ('left' = home, 'right' = away — matches the convention in
 * src/api.js → artPaletteForPick) into Supabase `public.results`.
 *
 * Run via:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/ingest-results.mjs
 *
 * Lookback can be tuned with INGEST_DAYS (default 4).
 *
 * The script is idempotent: existing rows are upserted on `game_id`.
 */

import { createClient } from '@supabase/supabase-js';

const ESPN_WNBA_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const LOOKBACK_DAYS = Math.max(1, Math.min(14, Number(process.env.INGEST_DAYS) || 4));

function fmtYmd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function buildRange(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  return `${fmtYmd(start)}-${fmtYmd(end)}`;
}

async function fetchScoreboard() {
  const url = `${ESPN_WNBA_SCOREBOARD}?dates=${buildRange(LOOKBACK_DAYS)}&limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN fetch failed ${res.status}`);
  return res.json();
}

function parseFinals(data) {
  const events = data?.events;
  if (!Array.isArray(events)) return [];
  const out = [];
  for (const ev of events) {
    const comp = ev.competitions?.[0];
    const teams = comp?.competitors;
    if (!teams || teams.length < 2) continue;
    const status = comp?.status?.type;
    if (!status?.completed) continue;
    const home = teams.find((c) => c.homeAway === 'home');
    const away = teams.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
    if (homeScore === awayScore) continue;
    const winner = homeScore > awayScore ? 'left' : 'right';
    out.push({
      game_id: String(ev.id),
      winner,
      home: home.team?.shortDisplayName || home.team?.name || '',
      away: away.team?.shortDisplayName || away.team?.name || '',
      score: `${home.team?.abbreviation || 'H'} ${homeScore} \u2013 ${awayScore} ${away.team?.abbreviation || 'A'}`,
    });
  }
  return out;
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[ingest] looking back ${LOOKBACK_DAYS} day(s)`);
  const data = await fetchScoreboard();
  const finals = parseFinals(data);
  console.log(`[ingest] found ${finals.length} completed game(s)`);

  if (finals.length === 0) return;

  const rows = finals.map((g) => ({
    game_id: g.game_id,
    winner: g.winner,
    source: 'espn-scoreboard',
    recorded_at: new Date().toISOString(),
  }));

  const { error } = await sb
    .from('results')
    .upsert(rows, { onConflict: 'game_id' });

  if (error) {
    console.error('[ingest] upsert failed', error);
    process.exit(1);
  }

  finals.forEach((g) => {
    console.log(`  ${g.game_id}  ${g.score}  -> winner=${g.winner}`);
  });
  console.log(`[ingest] wrote ${rows.length} row(s)`);
}

main().catch((err) => {
  console.error('[ingest] fatal', err);
  process.exit(1);
});
