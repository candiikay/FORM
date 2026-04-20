/** Wall page — a pinned gallery of forms and an abstract ledger of scores.
 *
 * The page is intentionally editorial: the gallery is a collage of people's
 * forms for today (shuffled deterministically so it rotates day to day), and
 * the ledger is a typographic poster where a name's size and the length of
 * its rule encode rank and score. No tabs, no per-row squiggles, no chrome.
 */

import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

import { fetchSchedule } from './api.js';
import { drawField } from './artwork.js';
import { getCurrentUser } from './auth.js';
import {
  getRangeLeaderboardSnapshot,
  mergeUserIntoRangeBoard,
  refreshRangeLeaderboard,
} from './leaderboard.js';
import { getPoints } from './state.js';
import { currentWeekLabel, weekIdForDate } from './week.js';
import { isSupabaseEnabled, getSupabase } from './supabase.js';
import { notifyWallStir } from './notifications.js';
import { loadPosts } from './wall-posts.js';
import { mountIdentityChip } from './identity-chip.js';

const MOCK_POOL_SIZE = 84;
const GALLERY_TILE_CAP = 6;
const MS_DAY = 24 * 60 * 60 * 1000;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}

function todayStampLabel() {
  // Editorial date line. Uppercase month abbrev so it reads like a kicker.
  const now = new Date();
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const m = months[now.getMonth()];
  return `TODAY · ${m} ${now.getDate()}`;
}

function dailySeed() {
  const t = startOfDay(new Date()).getTime();
  return hashStr(`day|${t}`);
}

/* ── Consensus (everyone's collective form) ─────────────────────── */

async function fetchRealConsensus(games) {
  if (!isSupabaseEnabled() || games.length === 0) return null;
  const sb = await getSupabase();
  if (!sb) return null;
  const weekId = weekIdForDate(new Date());
  const ids = games.map((g) => String(g.id));
  try {
    const { data, error } = await sb
      .from('consensus')
      .select('game_id, left_count, right_count, total')
      .eq('week_id', weekId)
      .in('game_id', ids);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const byGame = Object.create(null);
    const dominant = Object.create(null);
    for (const row of data) {
      const left = Number(row.left_count) || 0;
      const right = Number(row.right_count) || 0;
      const total = Number(row.total) || (left + right);
      if (total === 0) continue;
      byGame[row.game_id] = { left, right, total };
      dominant[row.game_id] = left >= right ? 'left' : 'right';
    }
    if (Object.keys(byGame).length === 0) return null;
    for (const g of games) {
      if (!byGame[g.id]) {
        byGame[g.id] = { left: 0, right: 0, total: 0 };
        dominant[g.id] = 'left';
      }
    }
    return { byGame, dominant, source: 'remote' };
  } catch (err) {
    console.warn('[wall] consensus failed', err);
    return null;
  }
}

function generateMockConsensus(games, weekLabel) {
  const baseSeed = hashStr(`${weekLabel}|${games.map((g) => g.id).join(',')}`);
  const byGame = Object.create(null);
  const dominant = Object.create(null);
  for (const game of games) {
    const r = seededRandom(baseSeed ^ hashStr(String(game.id)));
    let left = 0;
    let right = 0;
    for (let i = 0; i < MOCK_POOL_SIZE; i++) {
      if (r() < 0.5) left += 1;
      else right += 1;
    }
    if (left === right) right += 1;
    byGame[game.id] = { left, right, total: left + right };
    dominant[game.id] = left > right ? 'left' : 'right';
  }
  return { byGame, dominant };
}

async function resolveConsensus(schedule) {
  const real = await fetchRealConsensus(schedule);
  if (real && real.byGame && Object.values(real.byGame).some((c) => c.total > 0)) {
    return { ...real, source: 'remote' };
  }
  const mock = generateMockConsensus(schedule, currentWeekLabel());
  return { ...mock, source: 'mock' };
}

function strongestConsensusPick(games, byGame, dominant) {
  // The matchup the room agrees on the most — team name + share of the room.
  if (!games?.length) return null;
  let strongest = null;
  let strongestPct = 0;
  for (const game of games) {
    const counts = byGame[game.id];
    if (!counts || counts.total === 0) continue;
    const pct = Math.max(counts.left, counts.right) / counts.total;
    if (pct > strongestPct) {
      strongestPct = pct;
      strongest = { game, pick: dominant[game.id], pct };
    }
  }
  if (!strongest) return null;
  const team = strongest.pick === 'left' ? strongest.game.home : strongest.game.away;
  return { team, pct: strongest.pct, game: strongest.game, pick: strongest.pick };
}

function consensusWhisper(games, byGame, dominant) {
  const top = strongestConsensusPick(games, byGame, dominant);
  if (!top) return '';
  return `${Math.round(top.pct * 100)}% on ${top.team}`;
}

/* ── Canvas painter ─────────────────────────────────────────────── */

function paintFormCanvas(canvas, games, picks, options = {}) {
  if (!canvas || !games?.length) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement?.offsetWidth || 200;
  const aspect = options.aspect || 1.15;
  const cssH = Math.round(cssW * aspect);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.height = `${cssH}px`;

  const rowH = canvas.height / games.length;
  const layout = games.map((_, i) => ({
    midY: rowH * (i + 0.5),
    height: rowH,
  }));
  drawField(canvas, games, picks, layout);

  if (options.label) {
    if (options.label.variant === 'consensus') {
      paintConsensusLabel(canvas, options.label);
    } else if (options.label.variant === 'casual') {
      paintCasualLabel(canvas, options.label);
    }
  }
}

/**
 * Editorial top-pick call-out baked into the consensus canvas.
 * A small kicker ("TOP PICK"), a big percentage, and the team name — all
 * readable over the ink wash without covering the composition.
 */
function paintConsensusLabel(canvas, label) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H || !label?.team) return;

  const pctText = `${Math.round((label.pct || 0) * 100)}%`;
  const teamText = String(label.team).toUpperCase();
  const kicker = 'TOP PICK';

  const pctSize = Math.max(34, H * 0.26);
  const teamSize = Math.max(12, H * 0.075);
  const kickerSize = Math.max(9, H * 0.045);
  const pad = Math.max(14, H * 0.06);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const pctY = H - pad;
  const teamY = pctY - pctSize * 0.98;
  const kickerY = teamY - teamSize * 1.35;

  const kickerFont = `500 ${kickerSize}px 'Inter', system-ui, sans-serif`;
  const teamFont = `500 ${teamSize}px 'Inter', system-ui, sans-serif`;
  const pctFont = `400 ${pctSize}px 'Cormorant Garamond', Georgia, serif`;

  ctx.font = pctFont;
  const pctWidth = ctx.measureText(pctText).width;
  ctx.font = teamFont;
  const teamWidth = ctx.measureText(teamText).width;
  const blockWidth = Math.max(pctWidth, teamWidth) + pad * 0.4;

  // Soft vertical light behind the text so it lifts off the wash.
  const veil = ctx.createLinearGradient(0, 0, blockWidth + pad, 0);
  veil.addColorStop(0, 'rgba(246, 241, 230, 0.55)');
  veil.addColorStop(1, 'rgba(246, 241, 230, 0)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, kickerY - kickerSize * 1.4, blockWidth + pad, H - (kickerY - kickerSize * 1.4));

  ctx.font = kickerFont;
  ctx.fillStyle = 'rgba(26, 23, 20, 0.55)';
  const kickerMetrics = ctx.measureText(kicker);
  ctx.fillText(kicker, pad, kickerY);
  // Hairline after the kicker — editorial flourish.
  ctx.strokeStyle = 'rgba(26, 23, 20, 0.4)';
  ctx.lineWidth = Math.max(1, H * 0.002);
  ctx.beginPath();
  const lineY = kickerY - kickerSize * 0.32;
  ctx.moveTo(pad + kickerMetrics.width + pad * 0.35, lineY);
  ctx.lineTo(pad + kickerMetrics.width + pad * 0.35 + H * 0.12, lineY);
  ctx.stroke();

  ctx.font = teamFont;
  ctx.fillStyle = 'rgba(26, 23, 20, 0.82)';
  ctx.fillText(teamText, pad, teamY);

  ctx.font = pctFont;
  ctx.fillStyle = 'rgba(26, 23, 20, 0.92)';
  ctx.fillText(pctText, pad, pctY);

  ctx.restore();
}

/**
 * A signed, scribble-style caption tucked into the corner of a community tile.
 * Italic Cormorant at a slight tilt reads like a felt-tip tag on a polaroid.
 */
function paintCasualLabel(canvas, label) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H || !label?.text) return;

  const size = Math.max(12, H * 0.085);
  const pad = Math.max(10, H * 0.05);
  const text = `— ${String(label.text).toLowerCase()}`;

  ctx.save();
  ctx.font = `italic 400 ${size}px 'Cormorant Garamond', Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText(text);
  const x = W - metrics.width - pad;
  const y = H - pad;

  // Tiny parchment square behind the signature so it stays legible.
  const bgPadX = size * 0.45;
  ctx.fillStyle = 'rgba(246, 241, 230, 0.5)';
  ctx.fillRect(
    x - bgPadX,
    y - size * 0.95,
    metrics.width + bgPadX * 2,
    size * 1.3,
  );

  ctx.translate(x + metrics.width / 2, y - size * 0.35);
  ctx.rotate(-0.03);
  ctx.translate(-(x + metrics.width / 2), -(y - size * 0.35));
  ctx.fillStyle = 'rgba(26, 23, 20, 0.72)';
  ctx.fillText(text, x, y);

  ctx.restore();
}

/* ── Gallery ────────────────────────────────────────────────────── */

let lastSchedule = [];
let lastConsensus = null;
let lastPosts = [];

function shuffleByDay(posts) {
  // Stable across a single day, rotates at local midnight.
  const r = seededRandom(dailySeed());
  const arr = posts.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cssEscape(s) {
  return String(s).replace(/(["\\])/g, '\\$1');
}

function renderGallery() {
  const track = document.getElementById('wall-feed-track');
  const stamp = document.getElementById('gallery-stamp');
  if (!track) return;

  if (stamp) stamp.textContent = todayStampLabel();

  const topPick = lastConsensus
    ? strongestConsensusPick(lastSchedule, lastConsensus.byGame, lastConsensus.dominant)
    : null;

  const consensusTile = `
    <article class="tile tile--consensus" role="listitem" aria-label="Everyone's form today${topPick ? `: ${Math.round(topPick.pct * 100)}% on ${topPick.team}` : ''}">
      <div class="tile__plate">
        <canvas class="tile__canvas" data-canvas-room></canvas>
      </div>
      <p class="tile__sig tile__sig--consensus">everyone</p>
    </article>
  `;

  const shuffled = shuffleByDay(lastPosts).slice(0, GALLERY_TILE_CAP);

  const tiles = shuffled
    .map((post) => {
      const sig = (post.name || 'anon').toLowerCase();
      return `
        <article class="tile" role="listitem" data-post-id="${escapeHtml(post.id)}" aria-label="${escapeHtml(post.name)}'s form">
          <div class="tile__plate">
            <canvas class="tile__canvas" data-canvas-post="${escapeHtml(post.id)}"></canvas>
          </div>
        </article>
      `;
    })
    .join('');

  track.innerHTML = consensusTile + tiles;

  requestAnimationFrame(() => {
    if (lastConsensus) {
      const roomCanvas = track.querySelector('[data-canvas-room]');
      const label = topPick
        ? { variant: 'consensus', team: topPick.team, pct: topPick.pct }
        : null;
      paintFormCanvas(roomCanvas, lastSchedule, lastConsensus.dominant, {
        label,
      });
    }
    for (const post of shuffled) {
      const c = track.querySelector(`[data-canvas-post="${cssEscape(post.id)}"]`);
      if (!c) continue;
      paintFormCanvas(c, lastSchedule, post.picks, {
        label: { variant: 'casual', text: post.name || 'anon' },
      });
    }
  });
}

/* ── Ledger (abstract standings) ────────────────────────────────── */

let activeRange = weekRange();

function weekRange() {
  const today = startOfDay(new Date());
  return { start: addDays(today, -6), end: today };
}

function localUserRangeStats() {
  const days = Math.ceil((activeRange.end - activeRange.start) / MS_DAY) + 1;
  const seasonDays = 150;
  const seasonPts = getPoints();
  const ratio = Math.min(1, days / seasonDays);
  const pts = Math.round(seasonPts * ratio);
  const hits = Math.round(pts / 10);
  return { pts, hits, scored: hits };
}

function getActiveBoard(currentUser) {
  let board = getRangeLeaderboardSnapshot(activeRange);
  if (currentUser?.name) {
    const stats = localUserRangeStats();
    board = mergeUserIntoRangeBoard(board, currentUser.name, stats.pts, stats.hits, stats.scored);
  }
  return board;
}

function renderLedger(currentUser) {
  const list = document.getElementById('standings-list');
  const stamp = document.getElementById('ledger-stamp');
  if (!list) return;

  if (stamp) stamp.textContent = `THIS WEEK · ${(lastPosts?.length || 0) || '—'} playing`;

  const board = getActiveBoard(currentUser);
  const lowerName = (currentUser?.name || '').trim().toLowerCase();

  if (!board.length) {
    list.innerHTML = `
      <li class="ledger__row ledger__row--empty" role="listitem">
        <p class="ledger__empty">No one has locked in yet. First form sets the pace.</p>
      </li>
    `;
    return;
  }

  const top = board[0]?.pts || 1;
  const count = board.length;

  list.innerHTML = board
    .map((row, i) => {
      const isYou = lowerName && row.name.toLowerCase() === lowerName;
      const rankPct = count > 1 ? i / (count - 1) : 0;
      const scorePct = Math.max(0.06, Math.min(1, (row.pts || 0) / Math.max(1, top)));
      return `
        <li
          class="ledger__row${isYou ? ' ledger__row--you' : ''}"
          role="listitem"
          style="--rank-pct: ${rankPct.toFixed(3)}; --score-pct: ${scorePct.toFixed(3)};"
        >
          <div class="ledger__top">
            <span class="ledger__name">${escapeHtml(row.name)}${isYou ? ' <em class="ledger__you">· you</em>' : ''}</span>
            <span class="ledger__score">${row.pts}</span>
          </div>
          <div class="ledger__bar" aria-hidden="true"></div>
        </li>
      `;
    })
    .join('');
}

function refreshActiveLedger() {
  if (!isSupabaseEnabled()) return;
  refreshRangeLeaderboard(activeRange)
    .then(() => renderLedger(getCurrentUser()))
    .catch(() => {});
}

/* ── Realtime ───────────────────────────────────────────────────── */

let realtimeChannel = null;
let livePulseTimer = null;

function flashLivePulse(state) {
  const dot = document.getElementById('wall-live-dot');
  const label = document.getElementById('wall-live-label');
  if (!dot && !label) return;
  if (state === 'connected' && label) label.textContent = 'Live';
  if (state === 'mock' && label) label.textContent = 'Quiet';
  if (state === 'stir') {
    dot?.classList.add('gallery__live-dot--stir');
    clearTimeout(livePulseTimer);
    livePulseTimer = setTimeout(() => {
      dot?.classList.remove('gallery__live-dot--stir');
    }, 1400);
  } else if (state === 'connected') {
    dot?.classList.add('gallery__live-dot--on');
  } else if (state === 'mock') {
    dot?.classList.remove('gallery__live-dot--on');
    dot?.classList.remove('gallery__live-dot--stir');
  }
}

async function refreshFeed(reason) {
  if (!lastSchedule.length) return;
  lastConsensus = await resolveConsensus(lastSchedule);
  const { posts } = await loadPosts(lastSchedule);
  lastPosts = posts;
  renderGallery();
  renderLedger(getCurrentUser());
  if (reason === 'realtime') {
    flashLivePulse('stir');
    if (typeof document !== 'undefined' && document.hidden) {
      const whisper = consensusWhisper(lastSchedule, lastConsensus.byGame, lastConsensus.dominant);
      notifyWallStir(whisper ? `Forms shifting — ${whisper}` : 'A new form landed.');
    }
  }
}

async function setupRealtime() {
  if (!isSupabaseEnabled()) {
    flashLivePulse('mock');
    return;
  }
  const sb = await getSupabase();
  if (!sb) {
    flashLivePulse('mock');
    return;
  }
  if (realtimeChannel) {
    try { sb.removeChannel(realtimeChannel); } catch { /* ignore */ }
  }
  const weekId = weekIdForDate(new Date());

  realtimeChannel = sb
    .channel(`wall-${weekId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'picks', filter: `week_id=eq.${weekId}` },
      () => { refreshFeed('realtime'); },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'results' },
      () => {
        refreshFeed('realtime');
        refreshActiveLedger();
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') flashLivePulse('connected');
    });
}

window.addEventListener('beforeunload', async () => {
  if (!realtimeChannel) return;
  try {
    const sb = await getSupabase();
    sb?.removeChannel(realtimeChannel);
  } catch { /* ignore */ }
});

/* ── Init ───────────────────────────────────────────────────────── */

async function init() {
  mountIdentityChip();
  const user = getCurrentUser();
  renderLedger(user);

  const schedule = await fetchSchedule();
  lastSchedule = schedule;
  await refreshFeed('initial');

  if (isSupabaseEnabled()) {
    refreshActiveLedger();
    setupRealtime();
  } else {
    flashLivePulse('mock');
  }
}

init();

window.addEventListener('pageshow', () => {
  renderLedger(getCurrentUser());
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (lastSchedule.length) renderGallery();
    renderLedger(getCurrentUser());
  }, 160);
});
