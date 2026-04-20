/** "You" page — login (when guest) and your form / score / history (when known). */

import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

import {
  getCurrentUser,
  clearUser,
} from './auth.js';
import { mountAuthFlow } from './auth-ui.js';
import { mountIdentityChip } from './identity-chip.js';
import {
  getPoints,
  getStreakDays,
  getHistory,
  getHistoryEntry,
} from './state.js';
import { pointsCurve, scoreSeason } from './scoring.js';
import { renderShareCard } from './share.js';
import { weekLabelForDate } from './week.js';
import {
  isNotificationSupported,
  getNotificationPermission,
  loadPrefs,
  setEnabled,
  setChannel,
  requestPermission,
} from './notifications.js';

const CREAM = '#ede8e0';
const INK = '#1a1714';
const INK_MUTED = '#6b6560';
const INK_FAINT = '#b8b0a8';
const STROKE_TEAL = 'rgba(72,118,112,0.85)';

let toastTimer = null;

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


function knownTemplate(user, totals, weekLabel, weekEntry) {
  const name = user.name || 'You';
  const days = totals.streak;
  const streakLine = days > 0 ? `${days} day${days === 1 ? '' : 's'} in form` : 'just getting started';
  const headerKicker = name.toUpperCase();

  return `
    <section class="you-header">
      <p class="you-header__kicker">${escapeHtml(headerKicker)}</p>
      <h1 class="you-header__name">Your form</h1>
      <div class="you-header__meta">
        <span class="you-stat">
          <span class="you-stat__num">${totals.points}</span>
          <span class="you-stat__unit">pts</span>
        </span>
        <span class="you-header__divider" aria-hidden="true">·</span>
        <span class="you-header__streak">${escapeHtml(streakLine)}</span>
      </div>
      <button type="button" class="you-signout" id="you-signout">Sign out</button>
    </section>

    <section class="you-section" aria-labelledby="this-week-title">
      <header class="you-section__head">
        <h2 id="this-week-title" class="you-section__title">This week</h2>
        <span class="you-section__kicker">${escapeHtml(weekLabel)}</span>
      </header>
      <div class="you-week" id="you-week">${weekRowsMarkup(weekEntry)}</div>
    </section>

    <section class="you-section" aria-labelledby="curve-title">
      <header class="you-section__head">
        <h2 id="curve-title" class="you-section__title">Your form curve</h2>
        <span class="you-section__kicker">SEASON TO DATE</span>
      </header>
      <div class="you-curve">
        <canvas id="you-curve-canvas" class="you-curve__canvas" aria-label="Your weekly point totals"></canvas>
        <div class="you-curve__caption" id="you-curve-caption"></div>
      </div>
    </section>

    <section class="you-section" aria-labelledby="history-title">
      <header class="you-section__head">
        <h2 id="history-title" class="you-section__title">Past forms</h2>
        <span class="you-section__kicker">HISTORY</span>
      </header>
      <div class="you-history" id="you-history"></div>
    </section>

    <section class="you-section" aria-labelledby="notif-title">
      <header class="you-section__head">
        <h2 id="notif-title" class="you-section__title">Notifications</h2>
        <span class="you-section__kicker">QUIET BY DEFAULT</span>
      </header>
      <div class="you-notif" id="you-notif"></div>
    </section>
  `;
}

function notifSettingsMarkup() {
  if (!isNotificationSupported()) {
    return `
      <p class="you-notif__hint">This browser doesn't support notifications.</p>
    `;
  }
  const perm = getNotificationPermission();
  const prefs = loadPrefs();
  const allowed = perm === 'granted' && prefs.enabled;
  const denied = perm === 'denied';
  const promptable = perm === 'default';

  let header = '';
  if (denied) {
    header = `<p class="you-notif__hint">Notifications are blocked in your browser. Allow them in site settings to turn this on.</p>`;
  } else if (promptable) {
    header = `
      <button type="button" class="you-notif__cta" id="notif-enable">Allow notifications</button>
      <p class="you-notif__hint">We'll only buzz for the things you turn on below.</p>
    `;
  } else if (perm === 'granted') {
    header = `
      <label class="you-notif__row">
        <span class="you-notif__row-label">FORM may notify me</span>
        <input type="checkbox" id="notif-enabled" ${prefs.enabled ? 'checked' : ''} />
      </label>
    `;
  }

  const channelDisabled = !allowed ? 'disabled' : '';

  return `
    ${header}
    <div class="you-notif__channels">
      <label class="you-notif__row">
        <span class="you-notif__row-label">Lock-in confirmation</span>
        <input type="checkbox" id="notif-lockin" ${prefs.channels.lockIn ? 'checked' : ''} ${channelDisabled} />
      </label>
      <label class="you-notif__row">
        <span class="you-notif__row-label">Results &amp; scoring</span>
        <input type="checkbox" id="notif-results" ${prefs.channels.results ? 'checked' : ''} ${channelDisabled} />
      </label>
      <label class="you-notif__row">
        <span class="you-notif__row-label">When the Wall stirs</span>
        <input type="checkbox" id="notif-wall" ${prefs.channels.wallStir ? 'checked' : ''} ${channelDisabled} />
      </label>
    </div>
  `;
}

function attachNotifHandlers(rerenderSettings) {
  const enableBtn = document.getElementById('notif-enable');
  enableBtn?.addEventListener('click', async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      setEnabled(true);
      showToast('Notifications on');
    } else if (result === 'denied') {
      showToast('Notifications blocked in browser');
    }
    rerenderSettings();
  });

  const enabledBox = document.getElementById('notif-enabled');
  enabledBox?.addEventListener('change', (e) => {
    setEnabled(!!e.target.checked);
    rerenderSettings();
  });

  const map = {
    'notif-lockin': 'lockIn',
    'notif-results': 'results',
    'notif-wall': 'wallStir',
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    el?.addEventListener('change', (e) => {
      setChannel(key, !!e.target.checked);
    });
  });
}

function weekRowsMarkup(entry) {
  if (!entry || !Array.isArray(entry.games) || entry.games.length === 0) {
    return `
      <div class="you-week__empty">
        <p class="you-week__empty-text">You haven’t locked in a form for this week yet.</p>
        <a href="index.html" class="you-week__cta">Make your picks <span aria-hidden="true">↗</span></a>
      </div>
    `;
  }
  const rows = entry.games.map((g) => {
    const pick = entry.picks?.[g.id];
    const result = entry.results?.[g.id];
    const pickedTeam = pick === 'left' ? g.home : pick === 'right' ? g.away : null;
    const otherTeam = pick === 'left' ? g.away : pick === 'right' ? g.home : null;
    let status = 'pending';
    let statusLabel = 'pending';
    if (pick && (result === 'left' || result === 'right')) {
      if (result === pick) {
        status = 'hit';
        statusLabel = '+10';
      } else {
        status = 'miss';
        statusLabel = '0';
      }
    }
    if (!pick) {
      status = 'skipped';
      statusLabel = '—';
    }
    const day = (g.day || '').toUpperCase();
    return `
      <div class="you-week__row you-week__row--${status}">
        <span class="you-week__day">${escapeHtml(day)}</span>
        <span class="you-week__matchup">
          ${pickedTeam
            ? `<span class="you-week__pick">${escapeHtml(pickedTeam.toUpperCase())}</span>
               <span class="you-week__joiner">over</span>
               <span class="you-week__loser">${escapeHtml((otherTeam || '').toUpperCase())}</span>`
            : `<span class="you-week__loser">${escapeHtml(g.home.toUpperCase())}</span>
               <span class="you-week__joiner">vs</span>
               <span class="you-week__loser">${escapeHtml(g.away.toUpperCase())}</span>`}
        </span>
        <span class="you-week__status">${escapeHtml(statusLabel)}</span>
      </div>
    `;
  });
  return rows.join('');
}

/** Hand-drawn ink line of weekly point totals. */
function drawCurve(canvas, series) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.parentElement?.offsetWidth || 320;
  const cssH = 180;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, cssW, cssH);

  const padX = 18;
  const padTop = 22;
  const padBottom = 26;
  const innerW = cssW - padX * 2;
  const innerH = cssH - padTop - padBottom;

  ctx.strokeStyle = 'rgba(26,23,20,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, padTop);
  ctx.lineTo(padX, padTop + innerH);
  ctx.lineTo(padX + innerW, padTop + innerH);
  ctx.stroke();

  if (!Array.isArray(series) || series.length === 0) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 11px 'Inter', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No history yet — lock in a form to start your curve.', cssW / 2, cssH / 2);
    return;
  }

  const maxPts = Math.max(40, ...series.map((s) => s.points));
  const stepX = series.length === 1 ? 0 : innerW / (series.length - 1);

  ctx.fillStyle = INK_FAINT;
  ctx.font = `400 9px 'Inter', system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((maxPts * (4 - i)) / 4);
    const y = padTop + (innerH * i) / 4;
    ctx.fillText(`${v}`, padX - 4, y);
    ctx.strokeStyle = 'rgba(26,23,20,0.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + innerW, y);
    ctx.stroke();
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  series.forEach((point, i) => {
    const x = padX + stepX * i;
    const y = padTop + innerH - (point.points / maxPts) * innerH;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const prev = series[i - 1];
      const px = padX + stepX * (i - 1);
      const py = padTop + innerH - (prev.points / maxPts) * innerH;
      const cx1 = px + stepX * 0.5;
      const cy1 = py;
      const cx2 = x - stepX * 0.5;
      const cy2 = y;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
    }
  });
  ctx.stroke();

  ctx.fillStyle = INK;
  series.forEach((point, i) => {
    const x = padX + stepX * i;
    const y = padTop + innerH - (point.points / maxPts) * innerH;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (series.length > 0) {
    const last = series[series.length - 1];
    const x = padX + stepX * (series.length - 1);
    const y = padTop + innerH - (last.points / maxPts) * innerH;
    ctx.font = `italic 400 11px 'EB Garamond', Georgia, serif`;
    ctx.fillStyle = INK_MUTED;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${last.points} pts`, x - 4, y - 6);
    ctx.strokeStyle = STROKE_TEAL;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, padTop + innerH);
    ctx.stroke();
  }
}

function renderHistory(host, history) {
  if (!host) return;
  if (!Array.isArray(history) || history.length === 0) {
    host.innerHTML = `<p class="you-history__empty">Past weeks show up here once you lock in a form.</p>`;
    return;
  }
  host.innerHTML = history
    .map((entry, i) => {
      const correct = Number.isFinite(entry.correct) ? entry.correct : 0;
      const total = Array.isArray(entry.games) ? entry.games.length : (entry.total || 0);
      const pts = Number.isFinite(entry.pointsEarned) ? entry.pointsEarned : 0;
      const pending = Number.isFinite(entry.pending) ? entry.pending : 0;
      const recordLabel = pending > 0
        ? `${correct}/${total - pending} · ${pending} pending`
        : `${correct}/${total}`;
      return `
        <article class="you-history__entry">
          <div class="you-history__head">
            <p class="you-history__week">${escapeHtml(entry.weekLabel || '')}</p>
            <p class="you-history__points">+${pts}<span class="you-history__points-unit">pts</span></p>
          </div>
          <p class="you-history__record">${escapeHtml(recordLabel)}</p>
          <canvas
            class="you-history__canvas"
            id="you-history-canvas-${i}"
            aria-label="Form for ${escapeHtml(entry.weekLabel || 'past week')}"
          ></canvas>
        </article>
      `;
    })
    .join('');

  history.forEach((entry, i) => {
    const c = document.getElementById(`you-history-canvas-${i}`);
    if (!c) return;
    const w = c.parentElement?.offsetWidth || 320;
    const h = Math.round(w * 1.25);
    c.style.width = '100%';
    c.style.height = `${h}px`;
    if (!entry.games || entry.games.length === 0) return;
    renderShareCard(c, entry.games, entry.picks || {}, {
      weekLabel: entry.weekLabel,
      name: '',
    });
  });
}

function attachKnownHandlers(onChange) {
  const signout = document.getElementById('you-signout');
  signout?.addEventListener('click', () => {
    clearUser();
    showToast('signed out');
    onChange();
  });
}

function render() {
  const root = document.getElementById('you-root');
  if (!root) return;
  identityChip?.refresh();
  const user = getCurrentUser();

  if (!user || !user.name) {
    mountAuthFlow(root, {
      variant: 'page',
      onComplete: () => {
        identityChip?.refresh();
        render();
      },
    });
    return;
  }

  const totals = {
    points: getPoints(),
    streak: getStreakDays(),
  };
  const weekLabel = weekLabelForDate(new Date());
  const weekEntry = getHistoryEntry(weekLabel);
  root.innerHTML = knownTemplate(user, totals, weekLabel, weekEntry);

  attachKnownHandlers(render);

  const history = getHistory();
  const series = pointsCurve(history);
  const seasonTotals = scoreSeason(history);

  const canvas = document.getElementById('you-curve-canvas');
  if (canvas) {
    requestAnimationFrame(() => {
      drawCurve(canvas, series);
    });
  }

  const caption = document.getElementById('you-curve-caption');
  if (caption) {
    const pieces = [];
    if (seasonTotals.weeks > 0) {
      pieces.push(`${seasonTotals.pointsEarned} pts across ${seasonTotals.weeks} week${seasonTotals.weeks === 1 ? '' : 's'}`);
    }
    if (seasonTotals.correct > 0) {
      pieces.push(`${seasonTotals.correct} correct picks`);
    }
    caption.textContent = pieces.join(' · ');
  }

  renderHistory(document.getElementById('you-history'), history);

  function renderNotifSettings() {
    const host = document.getElementById('you-notif');
    if (!host) return;
    host.innerHTML = notifSettingsMarkup();
    attachNotifHandlers(renderNotifSettings);
  }
  renderNotifSettings();
}

const identityChip = mountIdentityChip();
window.addEventListener('pageshow', render);

let youResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(youResizeTimer);
  youResizeTimer = setTimeout(() => {
    const canvas = document.getElementById('you-curve-canvas');
    if (!canvas) return;
    const series = pointsCurve(getHistory());
    drawCurve(canvas, series);
  }, 140);
});

render();
