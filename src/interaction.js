import { drawField, animateBrushStroke } from './artwork.js';
import { artPaletteForPick } from './api.js';
import {
  getGames,
  setPick,
  isFormComplete,
  getPicks,
  bumpStreakOnSet,
  getStreakDays,
  getPoints,
  addPoints,
  archiveCurrentForm,
} from './state.js';
import { submitPicks } from './api.js';
import { getCurrentUser } from './auth.js';
import { mountAuthFlow } from './auth-ui.js';
import { getLeaderboardSnapshot, mergeUserIntoLeaderboard } from './leaderboard.js';
import { shareForm, shareFormMoving, renderShareCard } from './share.js';
import { isFfmpegSupported } from './video/ffmpeg.js';
import { notifyLockedIn } from './notifications.js';
import { getResults } from './results.js';
import { scoreWeek } from './scoring.js';
import { currentWeekLabel } from './week.js';

const SWIPE_MIN = 28;

let toastTimer = null;
let cancelAnimation = null;

// ── Helpers ────────────────────────────────────────────────────────────────

export function setWeekLabel() {
  const el = document.getElementById('week-label');
  if (!el) return;
  el.textContent = currentWeekLabel();
}

function syncSetUi() {
  const action = document.getElementById('set-action');
  if (action) {
    if (isFormComplete()) action.classList.add('ready');
    else action.classList.remove('ready');
  }
}

export function syncHeaderMeta() {
  const el = document.getElementById('streak-meta');
  if (!el) return;
  const days = getStreakDays();
  el.textContent = days > 0 ? `in FORM — ${days} day${days === 1 ? '' : 's'}` : '';
}

export function syncLeaderboard() {
  const host = document.getElementById('leaderboard-panel');
  if (!host) return;
  const rows = getLeaderboardSnapshot();
  host.innerHTML = rows
    .map((r, i) => {
      const leader = i === 0;
      const mark = leader ? '<span class="lb-mark" aria-hidden="true">✓</span>' : '';
      return `<div class="lb-row" role="listitem"><div class="lb-row__left"><span class="lb-rank">${i + 1}</span><span class="lb-name-cluster"><span class="lb-name">${escapeHtml(r.name)}</span>${mark}</span></div><span class="lb-axis-node" aria-hidden="true"></span><span class="lb-pts"><span class="lb-pts__prefix">+</span>${r.pts}<span class="lb-pts__unit">pts</span></span></div>`;
    })
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, duration = 3200) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, duration);
}

// ── Field canvas management ────────────────────────────────────────────────

function gameSeed(game) {
  return String(game.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
}

function pickSeed(game, direction) {
  return gameSeed(game) * 31 + (direction === 'left' ? 0 : 100);
}

/** Returns the shared field canvas pair from the games-container. */
function getFieldCanvases() {
  const container = document.getElementById('games-container');
  if (!container) return {};
  return {
    bg: container.querySelector('.field-canvas--bg'),
    fg: container.querySelector('.field-canvas--fg'),
    container,
  };
}

/**
 * Computes the absolute Y position and height of each game row
 * within the shared field canvas (DPR-scaled canvas pixels).
 */
function computeLayout(games) {
  const container = document.getElementById('games-container');
  if (!container) return [];
  const containerRect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return games.map((g) => {
    const row = document.getElementById(`row-${g.id}`);
    if (!row) return { midY: 0, height: 100 * dpr };
    const rowRect = row.getBoundingClientRect();
    const topRelative = rowRect.top - containerRect.top;
    const height = rowRect.height;
    return {
      midY: (topRelative + height * 0.52) * dpr,
      height: height * dpr,
    };
  });
}

/** Resize both field canvases to the container and redraw the full composition. */
function sizeField() {
  const { bg, fg, container } = getFieldCanvases();
  if (!container || !bg || !fg) return;
  const dpr = window.devicePixelRatio || 1;
  const w = container.offsetWidth;
  const h = container.offsetHeight;
  if (!w || !h) return;
  bg.width = w * dpr;
  bg.height = h * dpr;
  fg.width = w * dpr;
  fg.height = h * dpr;
  const games = getGames();
  const layout = computeLayout(games);
  drawField(bg, games, getPicks(), layout);
  const fctx = fg.getContext('2d');
  if (fctx) fctx.clearRect(0, 0, fg.width, fg.height);
}

/** Create (or locate) the shared bg + fg canvases on the container. */
function buildFieldCanvases(container) {
  let bg = container.querySelector('.field-canvas--bg');
  let fg = container.querySelector('.field-canvas--fg');
  if (!bg) {
    bg = document.createElement('canvas');
    bg.className = 'field-canvas field-canvas--bg';
    bg.setAttribute('aria-hidden', 'true');
    container.prepend(bg);
  }
  if (!fg) {
    fg = document.createElement('canvas');
    fg.className = 'field-canvas field-canvas--fg';
    fg.setAttribute('aria-hidden', 'true');
    container.prepend(fg);
  }
  return { bg, fg };
}

// ── Pick handling ──────────────────────────────────────────────────────────

export function doPick(game, direction, fgCanvas) {
  setPick(game.id, direction);

  const hint = document.getElementById('pick-hint');
  if (hint) hint.hidden = true;

  const palette = artPaletteForPick(game, direction);
  const seed = pickSeed(game, direction);

  const homeEl = document.getElementById(`home-${game.id}`);
  const awayEl = document.getElementById(`away-${game.id}`);
  if (homeEl) homeEl.classList.toggle('picked', direction === 'left');
  if (awayEl) awayEl.classList.toggle('picked', direction === 'right');

  const row = document.getElementById(`row-${game.id}`);
  if (row) {
    row.classList.remove('game-row--open');
    row.classList.add('game-row--has-pick');
  }
  if (!row || !fgCanvas) return;

  // Absolute position of this game's center within the full field canvas
  const container = document.getElementById('games-container');
  if (!container) return;
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const topRelative = rowRect.top - containerRect.top;
  const rowH = rowRect.height;
  const absoluteMidY = (topRelative + rowH * 0.54) * dpr;
  const rowHDpr = rowH * dpr;

  // Size fg canvas to the full field
  const w = container.offsetWidth;
  const h = container.offsetHeight;
  fgCanvas.width = w * dpr;
  fgCanvas.height = h * dpr;

  // Cancel any in-flight animation before starting a new one
  if (cancelAnimation) {
    cancelAnimation();
    cancelAnimation = null;
  }

  cancelAnimation = animateBrushStroke(
    fgCanvas, direction, palette, seed,
    () => {
      cancelAnimation = null;
      // Bake all picks into the bg field canvas
      const { bg } = getFieldCanvases();
      if (bg) {
        const games = getGames();
        const layout = computeLayout(games);
        drawField(bg, games, getPicks(), layout);
      }
      const ctx = fgCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
      syncSetUi();
    },
    absoluteMidY,
    rowHDpr,
  );
}

function attachRowGestures(row, game, fgCanvas) {
  let touchStartX = 0;
  let touchStartY = 0;
  let lastSwipePickAt = 0;

  row.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true },
  );

  row.addEventListener(
    'touchend',
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
        lastSwipePickAt = performance.now();
        doPick(game, dx < 0 ? 'right' : 'left', fgCanvas);
      }
    },
    { passive: true },
  );

  row.addEventListener('click', (e) => {
    if (performance.now() - lastSwipePickAt < 380) return;
    if (e.target.closest('button,a')) return;
    const rect = row.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dir = x < rect.width / 2 ? 'left' : 'right';
    doPick(game, dir, fgCanvas);
  });
}

// ── Build game rows ────────────────────────────────────────────────────────

export function buildGameRows() {
  const container = document.getElementById('games-container');
  if (!container) return;
  container.replaceChildren();

  const games = getGames();

  const hint = document.getElementById('pick-hint');
  if (hint) {
    hint.hidden = Object.keys(getPicks()).length > 0;
  }

  // ONE shared canvas pair for the full field — no per-row canvases
  const { fg } = buildFieldCanvases(container);

  games.forEach((g) => {
    const row = document.createElement('div');
    row.className = 'game-row';
    row.id = `row-${g.id}`;
    const existingPick = getPicks()[g.id];
    if (existingPick === 'left' || existingPick === 'right') {
      row.classList.add('game-row--has-pick');
    } else {
      row.classList.add('game-row--open');
    }

    const dayEl = document.createElement('div');
    dayEl.className = 'day-label';
    dayEl.textContent = g.day;

    const labels = document.createElement('div');
    labels.className = 'game-labels';

    const home = document.createElement('span');
    home.className = 'team team-left';
    home.id = `home-${g.id}`;
    home.textContent = g.home;
    if (existingPick === 'left') home.classList.add('picked');

    const vs = document.createElement('span');
    vs.className = 'vs-mark';
    vs.textContent = 'vs';

    const away = document.createElement('span');
    away.className = 'team team-right';
    away.id = `away-${g.id}`;
    away.textContent = g.away;
    if (existingPick === 'right') away.classList.add('picked');

    labels.appendChild(home);
    labels.appendChild(vs);
    labels.appendChild(away);
    row.appendChild(dayEl);
    row.appendChild(labels);

    attachRowGestures(row, g, fg);
    container.appendChild(row);
  });

  // Layout must be computed after rows are in the DOM
  requestAnimationFrame(() => {
    sizeField();
    syncSetUi();
    syncHeaderMeta();
    syncLeaderboard();
  });
}

export function reflowRowArtwork() {
  sizeField();
}

// ── Wire controls ──────────────────────────────────────────────────────────

/** Render the current form into the preview dialog's canvas at full share-card resolution. */
function paintPreviewCanvas() {
  const canvas = document.getElementById('preview-canvas');
  if (!canvas) return;
  const user = getCurrentUser();
  renderShareCard(canvas, getGames(), getPicks(), {
    weekLabel: document.getElementById('week-label')?.textContent || '',
    name: user?.name || '',
  });
}

/**
 * Render the "Save this form" panel inside the preview dialog when the viewer
 * is a guest. This is the moment of intent — they just locked in a form and
 * want to share/save it. We meet them with an inline phone OTP.
 */
function renderSavePanel() {
  const host = document.getElementById('preview-save');
  if (!host) return;
  const user = getCurrentUser();
  if (user && user.name) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  host.hidden = false;
  mountAuthFlow(host, {
    variant: 'panel',
    slug: user ? 'ALMOST THERE' : 'SAVE THIS FORM',
    headline: user ? 'What should we call you?' : 'Save your form',
    hint: user
      ? 'Add a name so the Wall knows who locked this one in.'
      : 'Sign in or sign up — keep this form, build your streak, land on the Wall.',
    onComplete: () => {
      renderSavePanel();
      const userNow = getCurrentUser();
      if (userNow?.name) {
        mergeUserIntoLeaderboard(userNow.name, getPoints(), getStreakDays());
        syncLeaderboard();
        showToast(`saved · welcome, ${userNow.name}`);
        // Repaint the share canvas so the byline reflects the new identity
        paintPreviewCanvas();
      }
    },
  });
}

/** Open the form pop-out. Repaints the canvas first so it reflects the latest picks. */
function openPreviewDialog() {
  const dialog = document.getElementById('preview-dialog');
  if (!dialog) return;

  // Wait for fonts so the share-card text doesn't flash a fallback face
  const fontsReady =
    document.fonts && document.fonts.ready
      ? document.fonts.ready.catch(() => undefined)
      : Promise.resolve();

  fontsReady.then(() => {
    paintPreviewCanvas();
    renderSavePanel();
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }
  });
}

function closePreviewDialog() {
  const dialog = document.getElementById('preview-dialog');
  if (!dialog) return;
  if (dialog.open) dialog.close();
}

export function wireSetAction() {
  const action = document.getElementById('set-action');
  if (!action) return;
  action.addEventListener('click', async () => {
    if (!action.classList.contains('ready')) return;

    const user = getCurrentUser();
    const weekLabel =
      document.getElementById('week-label')?.textContent || '';
    const picks = getPicks();
    const games = getGames();

    await submitPicks({ user, picks, weekLabel });
    bumpStreakOnSet();

    const results = getResults();
    const score = scoreWeek(picks, results);
    addPoints(score.pointsEarned);
    archiveCurrentForm({
      weekLabel,
      games,
      picks,
      results,
      pointsEarned: score.pointsEarned,
      correct: score.correct,
      total: score.total,
      pending: score.pending,
      lockedAt: new Date().toISOString(),
    });

    if (user?.name) {
      mergeUserIntoLeaderboard(user.name, getPoints(), getStreakDays());
    }

    action.classList.remove('ready');
    syncHeaderMeta();
    syncLeaderboard();

    if (score.pointsEarned > 0) {
      showToast(`+${score.pointsEarned} pts · form locked`);
    } else if (score.pending > 0) {
      showToast(`form locked · ${score.pending} pending`);
    } else {
      showToast('form locked');
    }
    notifyLockedIn({
      pointsEarned: score.pointsEarned,
      pending: score.pending,
      weekLabel,
    });

    const viewLink = document.getElementById('view-form');
    if (viewLink) viewLink.hidden = false;

    openPreviewDialog();
  });
}

export function wireViewForm() {
  const link = document.getElementById('view-form');
  if (!link) return;
  link.addEventListener('click', () => {
    openPreviewDialog();
  });
}

export function wirePreviewDialog() {
  const dialog = document.getElementById('preview-dialog');
  if (!dialog) return;
  const closeBtn = document.getElementById('preview-close');
  closeBtn?.addEventListener('click', () => closePreviewDialog());

  // Click on the backdrop (outside .preview) closes
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closePreviewDialog();
  });
}

function getOutputMode() {
  const checked = document.querySelector('input[name="output-mode"]:checked');
  return checked?.value === 'moving' ? 'moving' : 'still';
}

function wireOutputModeToggle() {
  const movingOpt = document.querySelector('input[name="output-mode"][value="moving"]');
  if (!movingOpt) return;
  const stillOpt = document.querySelector('input[name="output-mode"][value="still"]');
  if (!isFfmpegSupported()) {
    movingOpt.disabled = true;
    movingOpt.checked = false;
    if (stillOpt) stillOpt.checked = true;
    const label = movingOpt.closest('.preview__output-opt');
    if (label) label.title = 'Moving plates need a cross-origin isolated host';
  }
}

export function wireShareAction() {
  const action = document.getElementById('share-action');
  if (!action) return;
  wireOutputModeToggle();

  let busy = false;
  action.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    action.setAttribute('aria-busy', 'true');
    const textEl = action.querySelector('.preview__share-text');
    const original = textEl?.textContent;
    const mode = getOutputMode();
    if (textEl) textEl.textContent = mode === 'moving' ? 'Encoding…' : 'Composing…';

    try {
      const user = getCurrentUser();
      const opts = {
        weekLabel: document.getElementById('week-label')?.textContent || '',
        name: user?.name || '',
      };

      const result =
        mode === 'moving'
          ? await shareFormMoving(getGames(), getPicks(), opts)
          : await shareForm(getGames(), getPicks(), opts);

      if (result === 'shared') showToast('FORM shared');
      else if (result === 'downloaded') {
        showToast(mode === 'moving' ? 'Saved MP4 · share anywhere' : 'Saved · share from photos');
      } else if (result === 'still-fallback') {
        showToast('Saved a still · moving plate not supported here');
      } else if (result === 'unsupported') {
        showToast('Moving plates not supported here');
      } else if (result === 'error') {
        showToast('Couldn’t compose share');
      }
    } catch {
      showToast('Couldn’t compose share');
    } finally {
      if (textEl && original) textEl.textContent = original;
      action.removeAttribute('aria-busy');
      busy = false;
    }
  });
}

