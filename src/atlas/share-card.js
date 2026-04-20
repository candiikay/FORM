/**
 * Atlas share card — a square painting of one player's line from one game.
 *
 * Uses the exact same watercolor engine as the pick-em cards (`drawField`
 * from `src/artwork.js`), driven by the player's team's 3-color brand
 * palette. The painting builds up as the wizard collects more info:
 *
 *   step === 'team'   → one broad wash in the team's palette (preview)
 *   step === 'game'   → two wash bands (team vs. opponent)
 *   step === 'player' → three stat bands in the team's palette (final)
 *
 * The wall-text (kicker + athlete name + game context + stat values) is
 * painted on top. The painting is the hero; the text is wall text.
 */

import { drawField } from '../artwork.js';

const SIZE = 1080;
const CREAM = '#ede8e0';
const INK = '#1a1714';
const INK_MUTED = '#6b6560';
const INK_FAINT = '#b8b0a8';

const STAT_COPY = [
  { id: 'points',   label: 'Points',    short: 'PTS' },
  { id: 'rebounds', label: 'Rebounds',  short: 'REB' },
  { id: 'assists',  label: 'Assists',   short: 'AST' },
];

/* ── tiny utilities ────────────────────────────────────────────────── */

function hashSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function setLetterSpacing(ctx, em) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = em;
}

function hexToRgb(hex) {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return { r: 26, g: 23, b: 20 };
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function readableInkOn(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? INK : CREAM;
}

function firstHexOf(palette, fallback) {
  if (Array.isArray(palette) && palette[0]) return palette[0];
  return fallback;
}

/* ── wall-text helpers ─────────────────────────────────────────────── */

function drawKicker(ctx, text, x, y) {
  ctx.fillStyle = INK_MUTED;
  ctx.font = '500 22px "Inter", system-ui, sans-serif';
  setLetterSpacing(ctx, '0.32em');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(text).toUpperCase(), x, y);
  setLetterSpacing(ctx, '0px');
}

function drawHairline(ctx, x, y, w, alpha = 0.22) {
  ctx.strokeStyle = `rgba(26, 23, 20, ${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

function drawHeader(ctx, card) {
  const padX = 80;
  const kicker =
    card.step === 'player' ? 'Atlas \u00b7 Performance'
    : card.step === 'game' ? 'Atlas \u00b7 Game'
    : 'Atlas \u00b7 Team';
  drawKicker(ctx, kicker, padX, 108);
  drawHairline(ctx, padX, 128, 220, 0.24);

  // Title: athlete name (if picked), else team-vs-opponent, else team.
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  setLetterSpacing(ctx, '0.005em');

  const title = card.player?.name || card.team?.name || '';
  const titleFont = 'italic 400 66px "Cormorant Garamond", Georgia, serif';
  ctx.font = titleFont;
  ctx.fillText(title, padX, 198);

  // Sub: team short · vs/at opponent · date · result
  const subParts = [];
  if (card.team) subParts.push(card.team.short || card.team.name);
  if (card.game) {
    const vs = card.game.isHome ? 'vs' : 'at';
    subParts.push(`${vs} ${card.game.opponent?.short || card.game.opponent?.abbrev || ''}`);
    if (card.game.dateLabel) subParts.push(card.game.dateLabel);
    if (card.game.result) {
      subParts.push(`${card.game.result} ${card.game.teamScore}\u2013${card.game.oppScore}`);
    }
  }
  if (subParts.length) {
    ctx.fillStyle = INK_MUTED;
    ctx.font = '500 20px "Inter", system-ui, sans-serif';
    setLetterSpacing(ctx, '0.22em');
    ctx.fillText(subParts.join('  \u00b7  ').toUpperCase(), padX, 236);
    setLetterSpacing(ctx, '0px');
  }
}

/** Small colored pill anchoring a team abbreviation — same flavor as pick-em chips. */
function drawTeamChip(ctx, abbrev, accent, x, y, align = 'left') {
  const text = String(abbrev || '').toUpperCase();
  ctx.font = '700 16px "Inter", system-ui, sans-serif';
  setLetterSpacing(ctx, '0.22em');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const textW = ctx.measureText(text).width;
  const w = textW + 26;
  const h = 28;
  const left = align === 'right' ? x - w : x;
  ctx.fillStyle = accent || INK;
  ctx.fillRect(left, y - h / 2, w, h);
  ctx.fillStyle = readableInkOn(accent || INK);
  ctx.textAlign = 'center';
  ctx.fillText(text, left + w / 2, y + 1);
  setLetterSpacing(ctx, '0px');
  ctx.textBaseline = 'alphabetic';
}

/**
 * Big stat panel painted at the bottom — the editorial "dimensions of
 * the work" for the player card. Renders three stacked rows: stat kicker,
 * big italic number, unit short.
 */
function drawStatPanel(ctx, card) {
  if (!card.player) return;
  const padX = 80;
  const baseY = 860;
  const colW = (SIZE - padX * 2) / 3;

  STAT_COPY.forEach((stat, i) => {
    const cx = padX + colW * (i + 0.5);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = INK_MUTED;
    ctx.font = '500 14px "Inter", system-ui, sans-serif';
    setLetterSpacing(ctx, '0.32em');
    ctx.fillText(stat.label.toUpperCase(), cx, baseY);
    setLetterSpacing(ctx, '0px');

    ctx.fillStyle = INK;
    ctx.font = 'italic 400 88px "Cormorant Garamond", Georgia, serif';
    const value = Number(card.player[statKey(stat.id)] || 0);
    ctx.fillText(String(value), cx, baseY + 84);

    ctx.fillStyle = INK_MUTED;
    ctx.font = '500 14px "Inter", system-ui, sans-serif';
    setLetterSpacing(ctx, '0.28em');
    ctx.fillText(stat.short, cx, baseY + 110);
    setLetterSpacing(ctx, '0px');
  });

  // Team chip bottom-left, game meta bottom-right.
  ctx.textBaseline = 'middle';
  if (card.team) drawTeamChip(ctx, card.team.abbrev, card.team.accent, padX, SIZE - 60);
  ctx.textBaseline = 'alphabetic';
}

function statKey(statId) {
  if (statId === 'points') return 'pts';
  if (statId === 'rebounds') return 'reb';
  return 'ast';
}

function drawCitation(ctx) {
  ctx.fillStyle = INK_FAINT;
  ctx.font = '500 14px "Inter", system-ui, sans-serif';
  setLetterSpacing(ctx, '0.3em');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('FORM \u00b7 ATLAS \u00b7 DATA: ESPN', SIZE - 80, SIZE - 54);
  setLetterSpacing(ctx, '0px');
}

/* ── painting ──────────────────────────────────────────────────────── */

/**
 * Build a synthetic games + picks + layout tuple that `drawField` can
 * render. We reuse the pick-em painting engine so Atlas cards feel
 * consistent with the rest of FORM.
 *
 * Each `game` just carries the palettes we want that band to paint with;
 * the pick direction chooses which palette and biases the wash left/right
 * for compositional variety.
 */
function composeField(card, canvas) {
  const W = canvas.width;
  const H = canvas.height;

  // Painting region — sits between the header and the stat panel so
  // wall-text stays readable over cream, not ink.
  const topPx = Math.round(H * 0.27);
  const bottomPx = Math.round(H * 0.76);
  const areaH = bottomPx - topPx;

  const teamPalette = card.team?.palette || null;
  const oppPalette = card.game?.opponent?.palette || null;

  // Tier 1: team only — single broad wash across most of the region.
  if (card.step === 'team' || (!card.game && teamPalette)) {
    if (!teamPalette) return null;
    return {
      games: [{ id: `atlas-team-${card.team.abbrev}`, homePalette: teamPalette, awayPalette: teamPalette }],
      picks: { [`atlas-team-${card.team.abbrev}`]: 'left' },
      layout: [{ midY: topPx + areaH / 2, height: areaH }],
    };
  }

  // Tier 2: team + game — two bands, team over opponent (or vice-versa).
  if (card.step === 'game' || (card.game && !card.player)) {
    if (!teamPalette) return null;
    const bandH = Math.round(areaH * 0.55);
    const games = [
      {
        id: `atlas-team-${card.team.abbrev}`,
        homePalette: teamPalette,
        awayPalette: teamPalette,
      },
      {
        id: `atlas-opp-${card.game.opponent?.abbrev || 'opp'}`,
        homePalette: oppPalette || teamPalette,
        awayPalette: oppPalette || teamPalette,
      },
    ];
    return {
      games,
      picks: {
        [games[0].id]: 'left',
        [games[1].id]: 'right',
      },
      layout: [
        { midY: topPx + bandH / 2, height: bandH },
        { midY: bottomPx - bandH / 2, height: bandH },
      ],
    };
  }

  // Tier 3: player — three stat bands, all in the player's team palette.
  if (!teamPalette || !card.player) return null;
  const bandH = Math.round(areaH / 3);
  const games = STAT_COPY.map((stat) => ({
    id: `atlas-${stat.id}-${card.player.id}`,
    homePalette: teamPalette,
    awayPalette: teamPalette,
  }));
  const picks = {};
  const layout = [];
  STAT_COPY.forEach((stat, i) => {
    // Alternate wash bias so the three bands don't all lean the same way.
    picks[games[i].id] = i % 2 === 0 ? 'left' : 'right';
    layout.push({
      midY: topPx + bandH * (i + 0.5),
      height: bandH,
    });
  });
  return { games, picks, layout };
}

function paintPaper(ctx) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function paintFrame(ctx) {
  ctx.strokeStyle = 'rgba(26, 23, 20, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, SIZE - 80, SIZE - 80);
}

/* ── public API ────────────────────────────────────────────────────── */

/**
 * Paint the card onto a 1080×1080 canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} card  {
 *   step: 'team' | 'game' | 'player',
 *   team:   { abbrev, name, short, accent, palette: [hex,hex,hex] } | null,
 *   game:   { id, dateLabel, isHome, teamScore, oppScore, result,
 *             opponent: { abbrev, name, short, accent, palette } } | null,
 *   player: { id, name, pts, reb, ast, minutes } | null,
 * }
 * @param {{ previewScale?: number }} [opts]
 */
export function renderShareCard(canvas, card, opts = {}) {
  if (!canvas || !card) return;
  const previewScale = opts.previewScale || 1;
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.style.width = `${Math.round(SIZE * previewScale)}px`;
  canvas.style.height = `${Math.round(SIZE * previewScale)}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Paint the paper first — `drawField` does its own grain over this,
  // but we need a base in case composeField returns null.
  paintPaper(ctx);

  const field = composeField(card, canvas);
  if (field) {
    // drawField clears the whole canvas, then paints paper grain +
    // background wash + per-band ink washes. Same engine as pick-em.
    const seedOffset =
      hashSeed(
        [
          card.team?.abbrev || '',
          card.game?.id || '',
          card.player?.id || '',
        ].join('|') || 'atlas',
      ) % 997;
    drawField(canvas, field.games, field.picks, field.layout, seedOffset);
  }

  // Chrome on top of the painting.
  paintFrame(ctx);
  drawHeader(ctx, card);
  drawStatPanel(ctx, card);
  drawCitation(ctx);
  drawWordmark(ctx);
}

function drawWordmark(ctx) {
  ctx.fillStyle = INK;
  ctx.font = '300 28px "Cormorant Garamond", Georgia, serif';
  setLetterSpacing(ctx, '0.3em');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('FORM', 80, SIZE - 54);
  setLetterSpacing(ctx, '0px');
}

/** Export the canvas as a PNG blob — caller wires the share / download. */
export async function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas) return reject(new Error('no canvas'));
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
      1.0,
    );
  });
}

// Retain so callers that do `firstHexOf(card.team.palette, accent)` don't
// break if they ever bypass composeField. Not currently used internally.
export { firstHexOf };
