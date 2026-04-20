/**
 * Atlas maker — a 3-step painting wizard.
 *
 *   1. pick a team
 *   2. pick one of that team's recent games
 *   3. pick a player from that game's roster
 *
 * Each completed step collapses to a small chip above the picker so the
 * UI stays compact on mobile. The painting in the middle builds up as
 * each selection lands — a single team wash after step 1, a two-band
 * wash after step 2, and the full three-stat painting after step 3.
 *
 * The painting engine is the same watercolor system the pick-em cards
 * use (`drawField`), driven by each team's 3-color brand palette.
 *
 * URL state — ?team=XXX&game=NNN&player=PPP — for permalinks.
 */

import {
  WNBA_TEAMS,
  getTeam,
  fetchTeamSchedule,
  fetchGameRoster,
  formatShortDate,
} from './leader.js';
import { renderShareCard, canvasToPngBlob } from './share-card.js';

/* ── state ─────────────────────────────────────────────────────────── */

const state = {
  host: null,
  canvas: null,
  step: 'team',   // 'team' | 'game' | 'player' | 'ready'

  team: null,
  schedule: [],
  scheduleLoading: false,
  scheduleError: null,

  game: null,
  roster: null,
  rosterLoading: false,
  rosterError: null,

  player: null,

  onToast: null,
};

/* ── html escaping ─────────────────────────────────────────────────── */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(text) {
  if (typeof state.onToast === 'function') state.onToast(text);
}

/* ── derived card ──────────────────────────────────────────────────── */

function currentCard() {
  if (!state.team) return null;
  return {
    step: state.player ? 'player' : state.game ? 'game' : 'team',
    team: pickTeam(state.team),
    game: state.game
      ? {
          id: state.game.id,
          dateLabel: state.game.dateLabel,
          isHome: state.game.isHome,
          teamScore: state.game.teamScore,
          oppScore: state.game.oppScore,
          result: state.game.result,
          opponent: pickTeam(state.game.opponent),
        }
      : null,
    player: state.player
      ? {
          id: state.player.id,
          name: state.player.name,
          pts: state.player.pts,
          reb: state.player.reb,
          ast: state.player.ast,
          minutes: state.player.minutes,
          position: state.player.position,
        }
      : null,
  };
}

function pickTeam(t) {
  if (!t) return null;
  return {
    abbrev: t.abbrev,
    name: t.name,
    short: t.short || t.name,
    accent: t.accent,
    palette: t.palette || null,
  };
}

/* ── shell markup ──────────────────────────────────────────────────── */

function shellMarkup() {
  return `
    <section class="atlas-maker" aria-label="Atlas card maker">
      <header class="atlas-maker__head">
        <p class="atlas-maker__kicker">ATLAS \u00b7 PERFORMANCE CARDS</p>
        <h1 class="atlas-maker__title">Any player, any game, painted.</h1>
      </header>

      <nav class="atlas-maker__chips" id="maker-chips" aria-label="Selection"></nav>

      <div class="atlas-maker__stage" id="maker-stage">
        <div class="atlas-maker__canvas-wrap" id="maker-canvas-wrap" hidden>
          <canvas id="maker-canvas" class="atlas-maker__canvas" aria-label="Card preview"></canvas>
        </div>
        <p class="atlas-maker__stage-empty" id="maker-stage-empty">
          Pick a team to start painting.
        </p>
      </div>

      <div class="atlas-maker__picker" id="maker-picker" aria-live="polite"></div>

      <div class="atlas-maker__actions" id="maker-actions" hidden>
        <button type="button" id="maker-share" class="atlas-maker__send" aria-label="Share this card">
          <span class="atlas-maker__send-text">Share</span>
          <span class="atlas-maker__send-kicker">send this painting</span>
        </button>
      </div>
    </section>
  `;
}

/* ── chips (compact breadcrumbs) ───────────────────────────────────── */

function renderChips() {
  const host = state.host.querySelector('#maker-chips');
  if (!host) return;
  const chips = [];

  if (state.team) {
    chips.push(chipMarkup({
      step: 'team',
      accent: state.team.accent,
      label: state.team.short || state.team.name,
      active: state.step === 'team',
    }));
  }
  if (state.game) {
    const vs = state.game.isHome ? 'vs' : 'at';
    chips.push(chipMarkup({
      step: 'game',
      accent: state.game.opponent?.accent,
      label: `${vs} ${state.game.opponent?.short || state.game.opponent?.abbrev || ''} \u00b7 ${state.game.dateLabel || ''}`,
      active: state.step === 'game',
    }));
  }
  if (state.player) {
    chips.push(chipMarkup({
      step: 'player',
      accent: state.team?.accent,
      label: state.player.name,
      active: state.step === 'player',
    }));
  }

  host.innerHTML = chips.join('');
  host.hidden = !chips.length;

  host.querySelectorAll('[data-chip-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = btn.getAttribute('data-chip-step');
      if (!step) return;
      goToStep(step);
    });
  });
}

function chipMarkup({ step, accent, label, active }) {
  return `
    <button
      type="button"
      class="atlas-maker__chip ${active ? 'is-active' : ''}"
      data-chip-step="${escapeHtml(step)}"
      aria-label="Change ${escapeHtml(step)}"
    >
      <span class="atlas-maker__chip-dot" style="background:${escapeHtml(accent || '#1a1714')}"></span>
      <span class="atlas-maker__chip-label">${escapeHtml(label)}</span>
      <span class="atlas-maker__chip-edit" aria-hidden="true">change</span>
    </button>
  `;
}

/* ── step picker ───────────────────────────────────────────────────── */

function renderPicker() {
  const host = state.host.querySelector('#maker-picker');
  if (!host) return;

  let html = '';
  if (state.step === 'team')        html = teamPickerMarkup();
  else if (state.step === 'game')   html = gamePickerMarkup();
  else if (state.step === 'player') html = playerPickerMarkup();
  else html = readyMarkup();

  host.innerHTML = html;
  wirePicker();
}

function teamPickerMarkup() {
  const label = state.team
    ? 'Swap the team — game and player reset.'
    : 'Pick a team to start.';

  const teams = WNBA_TEAMS.map((t) => {
    const active = state.team?.abbrev === t.abbrev;
    const [c0, c1, c2] = t.palette || [t.accent, t.accent, t.accent];
    return `
      <button
        type="button"
        class="atlas-maker__team ${active ? 'is-on' : ''}"
        data-team="${escapeHtml(t.abbrev)}"
      >
        <span class="atlas-maker__team-swatch" aria-hidden="true">
          <span style="background:${escapeHtml(c0)}"></span>
          <span style="background:${escapeHtml(c1)}"></span>
          <span style="background:${escapeHtml(c2)}"></span>
        </span>
        <span class="atlas-maker__team-name">${escapeHtml(t.short || t.name)}</span>
        <span class="atlas-maker__team-city">${escapeHtml(t.name.replace(t.short || '', '').trim())}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="atlas-maker__step">
      <p class="atlas-maker__step-head"><span class="atlas-maker__step-index">01</span> ${escapeHtml(label)}</p>
      <div class="atlas-maker__teams" role="radiogroup" aria-label="WNBA teams">
        ${teams}
      </div>
    </div>
  `;
}

function gamePickerMarkup() {
  if (state.scheduleLoading) {
    return pickerBody('02', 'Loading recent games\u2026', '');
  }
  if (state.scheduleError) {
    return pickerBody('02', state.scheduleError, '');
  }
  if (!state.schedule.length) {
    return pickerBody('02', `No recent games for ${state.team?.short || ''}.`, '');
  }

  const rows = state.schedule.slice(0, 20).map(gameRowMarkup).join('');

  return pickerBody(
    '02',
    `Pick a game from the ${state.team?.short || ''}'s recent results.`,
    `<div class="atlas-maker__games" role="radiogroup" aria-label="Recent games">${rows}</div>`,
  );
}

function gameRowMarkup(g) {
  const active = state.game?.id === g.id;
  const vs = g.isHome ? 'vs' : 'at';
  const oppAccent = g.opponent?.accent || '#1a1714';
  const resultClass = g.result === 'W' ? 'is-win' : g.result === 'L' ? 'is-loss' : '';
  return `
    <button
      type="button"
      class="atlas-maker__game ${active ? 'is-on' : ''}"
      role="radio"
      aria-checked="${active ? 'true' : 'false'}"
      data-game="${escapeHtml(g.id)}"
    >
      <span class="atlas-maker__game-result ${resultClass}">${escapeHtml(g.result || '\u2014')}</span>
      <span class="atlas-maker__game-main">
        <span class="atlas-maker__game-line">
          <span class="atlas-maker__game-vs">${escapeHtml(vs)}</span>
          <span class="atlas-maker__game-dot" style="background:${escapeHtml(oppAccent)}"></span>
          <span class="atlas-maker__game-opp">${escapeHtml(g.opponent?.short || g.opponent?.abbrev || '')}</span>
        </span>
        <span class="atlas-maker__game-date">${escapeHtml(g.dateLabel)}</span>
      </span>
      <span class="atlas-maker__game-score">${g.teamScore}\u2013${g.oppScore}</span>
    </button>
  `;
}

function playerPickerMarkup() {
  if (state.rosterLoading) {
    return pickerBody('03', 'Loading boxscore\u2026', '');
  }
  if (state.rosterError) {
    return pickerBody('03', state.rosterError, '');
  }
  const myRoster = mySideOfRoster();
  if (!myRoster || !myRoster.players.length) {
    return pickerBody('03', 'Boxscore hasn\u2019t posted yet for this game.', '');
  }

  const rows = myRoster.players.slice(0, 14).map(playerRowMarkup).join('');
  return pickerBody(
    '03',
    `Pick a ${state.team?.short || ''} player.`,
    `<div class="atlas-maker__players" role="radiogroup" aria-label="Players">${rows}</div>`,
  );
}

function playerRowMarkup(p) {
  const active = state.player?.id === p.id;
  return `
    <button
      type="button"
      class="atlas-maker__player ${active ? 'is-on' : ''}"
      role="radio"
      aria-checked="${active ? 'true' : 'false'}"
      data-player="${escapeHtml(p.id)}"
    >
      <span class="atlas-maker__player-name">${escapeHtml(p.name)}</span>
      <span class="atlas-maker__player-line">
        <span>${p.pts}<em>pts</em></span>
        <span>${p.reb}<em>reb</em></span>
        <span>${p.ast}<em>ast</em></span>
      </span>
    </button>
  `;
}

function readyMarkup() {
  // Picker collapses once the painting is ready; chips + share button
  // carry the UI forward. A small note lets viewers know why.
  return `
    <div class="atlas-maker__step atlas-maker__step--ready">
      <p class="atlas-maker__step-head">
        <span class="atlas-maker__step-index">\u2713</span>
        Painted. Tap a chip above to change any of the three.
      </p>
    </div>
  `;
}

function pickerBody(index, headline, body) {
  return `
    <div class="atlas-maker__step">
      <p class="atlas-maker__step-head">
        <span class="atlas-maker__step-index">${escapeHtml(index)}</span>
        ${escapeHtml(headline)}
      </p>
      ${body}
    </div>
  `;
}

function mySideOfRoster() {
  if (!state.roster || !state.team) return null;
  if (state.roster.home?.abbrev === state.team.abbrev) return state.roster.home;
  if (state.roster.away?.abbrev === state.team.abbrev) return state.roster.away;
  // Fallback: sometimes ESPN abbreviations drift; pick whichever side
  // shares the selected team's name.
  if (state.roster.home?.name === state.team.name) return state.roster.home;
  if (state.roster.away?.name === state.team.name) return state.roster.away;
  return null;
}

/* ── wiring ────────────────────────────────────────────────────────── */

function wirePicker() {
  const host = state.host.querySelector('#maker-picker');
  if (!host) return;

  host.querySelectorAll('[data-team]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const abbrev = btn.getAttribute('data-team');
      setTeam(abbrev);
    });
  });
  host.querySelectorAll('[data-game]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-game');
      setGameById(id);
    });
  });
  host.querySelectorAll('[data-player]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-player');
      setPlayerById(id);
    });
  });
}

function wireShare() {
  const btn = state.host.querySelector('#maker-share');
  if (!btn) return;
  btn.addEventListener('click', doShare);
}

/* ── transitions ───────────────────────────────────────────────────── */

async function setTeam(abbrev) {
  const team = getTeam(abbrev);
  if (!team) return;
  const sameTeam = state.team?.abbrev === team.abbrev;
  state.team = team;
  if (!sameTeam) {
    state.game = null;
    state.roster = null;
    state.player = null;
  }
  state.step = 'game';
  updateUrl();
  paintAll();

  if (!sameTeam || !state.schedule.length) {
    await loadSchedule();
  }
}

async function setGameById(gameId) {
  const game = state.schedule.find((g) => g.id === gameId);
  if (!game) return;
  const sameGame = state.game?.id === game.id;
  state.game = game;
  if (!sameGame) {
    state.roster = null;
    state.player = null;
  }
  state.step = 'player';
  updateUrl();
  paintAll();

  if (!sameGame || !state.roster) {
    await loadRoster();
  }
}

function setPlayerById(playerId) {
  const myRoster = mySideOfRoster();
  if (!myRoster) return;
  const player = myRoster.players.find((p) => p.id === playerId);
  if (!player) return;
  state.player = player;
  state.step = 'ready';
  updateUrl();
  paintAll();
}

function goToStep(step) {
  if (step === 'team')        state.step = 'team';
  else if (step === 'game')   state.step = 'game';
  else if (step === 'player') state.step = 'player';
  else                         state.step = 'ready';
  renderChips();
  renderPicker();
  showActions();
}

/* ── loading ───────────────────────────────────────────────────────── */

async function loadSchedule() {
  if (!state.team) return;
  state.scheduleLoading = true;
  state.scheduleError = null;
  state.schedule = [];
  renderPicker();
  try {
    const games = await fetchTeamSchedule(state.team.abbrev);
    state.schedule = games;
  } catch {
    state.scheduleError = 'Could not load the schedule.';
  } finally {
    state.scheduleLoading = false;
    renderPicker();
  }
}

async function loadRoster() {
  if (!state.game) return;
  state.rosterLoading = true;
  state.rosterError = null;
  state.roster = null;
  renderPicker();
  try {
    const roster = await fetchGameRoster(state.game.id);
    state.roster = roster;
    if (!roster) state.rosterError = 'No boxscore available for this game.';
  } catch {
    state.rosterError = 'Could not load the boxscore.';
  } finally {
    state.rosterLoading = false;
    renderPicker();
  }
}

/* ── paint ─────────────────────────────────────────────────────────── */

function paintAll() {
  renderChips();
  renderPicker();
  paintCanvas();
  showActions();
}

function paintCanvas() {
  const wrap = state.host.querySelector('#maker-canvas-wrap');
  const empty = state.host.querySelector('#maker-stage-empty');
  if (!wrap || !empty) return;

  const card = currentCard();
  if (!card) {
    wrap.hidden = true;
    empty.hidden = false;
    return;
  }
  wrap.hidden = false;
  empty.hidden = true;

  requestAnimationFrame(() => {
    const scale = previewScaleFor(wrap);
    renderShareCard(state.canvas, card, { previewScale: scale });
  });
}

function showActions() {
  const actions = state.host.querySelector('#maker-actions');
  if (!actions) return;
  actions.hidden = !(state.step === 'ready' && state.player);
}

function previewScaleFor(el) {
  const w = el?.clientWidth || 540;
  return Math.min(1, w / 1080);
}

/* ── share ─────────────────────────────────────────────────────────── */

async function doShare() {
  if (!state.canvas) return;
  const card = currentCard();
  if (!card || !card.player) return;
  const filename = `form-atlas-${slug(card.team.abbrev)}-${slug(card.player.name)}.png`;
  try {
    const blob = await canvasToPngBlob(state.canvas);
    const file = new File([blob], filename, { type: 'image/png' });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] }) &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `${card.player.name} \u00b7 FORM Atlas`,
          text: `${card.player.name} \u2014 ${card.player.pts} / ${card.player.reb} / ${card.player.ast}`,
        });
        showToast('sent');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('copied to clipboard');
        return;
      } catch {
        /* fall through to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('saved \u00b7 png');
  } catch (err) {
    console.warn('[atlas] share failed', err);
    showToast('share failed');
  }
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

/* ── url state ─────────────────────────────────────────────────────── */

function updateUrl() {
  const params = new URLSearchParams();
  if (state.team) params.set('team', state.team.abbrev);
  if (state.game) params.set('game', state.game.id);
  if (state.player) params.set('player', state.player.id);
  const q = params.toString();
  const next = `${window.location.pathname}${q ? `?${q}` : ''}`;
  if (next !== window.location.pathname + window.location.search) {
    window.history.replaceState(null, '', next);
  }
}

async function resumeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const teamAbbrev = params.get('team');
  const gameId = params.get('game');
  const playerId = params.get('player');

  if (!teamAbbrev) return;
  const team = getTeam(teamAbbrev);
  if (!team) return;
  state.team = team;
  state.step = 'game';
  paintAll();
  await loadSchedule();

  if (!gameId) return;
  const game = state.schedule.find((g) => g.id === gameId);
  if (!game) return;
  state.game = game;
  state.step = 'player';
  paintAll();
  await loadRoster();

  if (!playerId) return;
  const myRoster = mySideOfRoster();
  const player = myRoster?.players.find((p) => p.id === playerId);
  if (!player) return;
  state.player = player;
  state.step = 'ready';
  paintAll();
}

/* ── mount ─────────────────────────────────────────────────────────── */

export async function mountMaker(host, { onToast } = {}) {
  if (!host) return;
  state.host = host;
  state.onToast = onToast || null;

  host.innerHTML = shellMarkup();
  state.canvas = host.querySelector('#maker-canvas');

  renderChips();
  renderPicker();
  wireShare();

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(paintCanvas);
  });

  await resumeFromUrl();
  // If nothing resumed, we already sit at step='team' with no chips and
  // the team picker showing — nothing else to do.
  if (!state.team) {
    paintAll();
  }
}

// Retain named export so admin consumers that import the shared team
// catalog still resolve through this module.
export { WNBA_TEAMS, formatShortDate };
