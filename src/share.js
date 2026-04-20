/**
 * Share card composer.
 * Renders a portrait (4:5) poster of the user's form for IG / iMessage / etc.
 *
 * The slogan "FORM of the week" riffs on the brand mark and on the
 * sports-shorthand "Game of the week" — same cadence, more soul.
 */

import { drawField, captureCanvasFrames } from './artwork.js';
import {
  isFfmpegSupported,
  encodeFramesToMp4,
  downloadBlob,
} from './video/ffmpeg.js';

const SHARE_W = 1080;
const SHARE_H = 1350;
const SLOGAN = 'FORM of the week';
function tagline() {
  return `set in ink · ${new Date().getFullYear()}`;
}

const CREAM = '#ede8e0';
const INK = '#1a1714';
const INK_MUTED = '#6b6560';
const INK_FAINT = '#b8b0a8';

function paintBackground(ctx, seed) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // Paper grain — irregular flecks, deterministic per-card so the dots don't crawl
  const rand = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < 2400; i++) {
    const x = rand() * SHARE_W;
    const y = rand() * SHARE_H;
    const a = 0.03 + rand() * 0.08;
    ctx.fillStyle = `rgba(26,23,20,${a})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawHairline(ctx, x1, y, x2, alpha = 0.18) {
  ctx.fillStyle = `rgba(26,23,20,${alpha})`;
  ctx.fillRect(x1, y, x2 - x1, 1);
}

function drawHeader(ctx, weekLabel, name) {
  ctx.textBaseline = 'alphabetic';

  // Wordmark — same chic editorial treatment as the website masthead:
  // light Cormorant, all-caps, generously letterspaced.
  ctx.fillStyle = INK;
  ctx.font = '300 148px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.32em';
  ctx.fillText('FORM', 80, 192);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // Right column: slogan kicker + week range
  ctx.textAlign = 'right';
  ctx.fillStyle = INK_MUTED;
  ctx.font = '400 22px "Inter", system-ui, sans-serif';
  ctx.fillText(SLOGAN.toUpperCase(), SHARE_W - 80, 142);

  if (weekLabel) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = '400 20px "Inter", system-ui, sans-serif';
    ctx.fillText(weekLabel.toUpperCase(), SHARE_W - 80, 174);
  }
  if (name) {
    ctx.fillStyle = INK_MUTED;
    ctx.font = 'italic 400 22px "EB Garamond", Georgia, serif';
    ctx.fillText(`— ${name}`, SHARE_W - 80, 204);
  }

  drawHairline(ctx, 80, 246, SHARE_W - 80, 0.16);
}

function drawArtwork(ctx, games, picks, top, bottom, seedOffset = 0) {
  const w = SHARE_W;
  const h = bottom - top;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const rowH = h / Math.max(games.length, 1);
  const layout = games.map((_, i) => ({
    midY: rowH * (i + 0.5),
    height: rowH,
  }));
  drawField(off, games, picks, layout, seedOffset);
  ctx.drawImage(off, 0, top);
}

/** Returns the team text that gets the ink-dark "winner" treatment. */
function pickStatement(game, pick) {
  if (pick === 'left') return { winner: game.home, loser: game.away, joiner: 'over' };
  if (pick === 'right') return { winner: game.away, loser: game.home, joiner: 'over' };
  return { winner: game.home, loser: game.away, joiner: 'vs' };
}

function drawPicksList(ctx, games, picks, top, bottom) {
  const left = 80;
  const right = SHARE_W - 80;
  const lineCount = games.length;
  const usable = bottom - top;
  const lineH = usable / Math.max(lineCount, 1);

  games.forEach((game, i) => {
    const pick = picks[game.id];
    const baseY = top + lineH * (i + 0.5);

    // Day kicker
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = '400 22px "Inter", system-ui, sans-serif';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText((game.day || '').toUpperCase(), left, baseY);

    // Pick statement — winner ink-dark, joiner italic, loser muted
    const { winner, loser, joiner } = pickStatement(game, pick);
    const winnerStr = winner.toUpperCase();
    const loserStr = loser.toUpperCase();

    ctx.font = '400 42px "Cormorant Garamond", Georgia, serif';
    const winnerW = ctx.measureText(winnerStr).width;
    ctx.font = 'italic 400 30px "EB Garamond", Georgia, serif';
    const joinerW = ctx.measureText(' ' + joiner + ' ').width;
    ctx.font = '400 42px "Cormorant Garamond", Georgia, serif';
    const loserW = ctx.measureText(loserStr).width;
    const totalW = winnerW + joinerW + loserW;

    // Right-align the statement so day kicker on the left has its own column
    let cursorX = right - totalW;

    ctx.fillStyle = pick ? INK : INK_MUTED;
    ctx.font = '400 42px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(winnerStr, cursorX, baseY);
    cursorX += winnerW;

    ctx.fillStyle = INK_FAINT;
    ctx.font = 'italic 400 30px "EB Garamond", Georgia, serif';
    ctx.fillText(' ' + joiner + ' ', cursorX, baseY);
    cursorX += joinerW;

    ctx.fillStyle = pick ? INK_MUTED : INK_FAINT;
    ctx.font = '400 42px "Cormorant Garamond", Georgia, serif';
    ctx.fillText(loserStr, cursorX, baseY);

    if (i < lineCount - 1) {
      drawHairline(ctx, left, top + lineH * (i + 1), right, 0.08);
    }
  });
}

function drawFooter(ctx) {
  drawHairline(ctx, 80, SHARE_H - 80, SHARE_W - 80, 0.16);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = '300 24px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = INK;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.3em';
  ctx.fillText('FORM', 80, SHARE_H - 44);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  ctx.textAlign = 'right';
  ctx.font = '400 18px "Inter", system-ui, sans-serif';
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(tagline().toUpperCase(), SHARE_W - 80, SHARE_H - 44);
}

/**
 * Render the share card into the given canvas at the share dimensions.
 * Caller is responsible for sizing.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object[]} games
 * @param {Record<string, 'left'|'right'>} picks
 * @param {{weekLabel?: string, name?: string}} [options]
 */
export function renderShareCard(canvas, games, picks, options = {}) {
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const seed =
    games.reduce(
      (acc, g) =>
        acc + String(g.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0),
      0,
    ) + 901;

  paintBackground(ctx, seed);
  drawHeader(ctx, options.weekLabel, options.name);
  drawArtwork(ctx, games, picks, 270, 940, options.seedOffset || 0);
  drawPicksList(ctx, games, picks, 970, SHARE_H - 110);
  drawFooter(ctx);
}

/** Convert canvas → PNG blob. */
function canvasToPngBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
}

/**
 * Build the share card and try to share it natively.
 * Falls back to PNG download when Web Share is unavailable
 * (most desktop browsers, all non-PWA Firefox, etc).
 *
 * @param {object[]} games
 * @param {Record<string, 'left'|'right'>} picks
 * @param {{weekLabel?: string, name?: string}} options
 * @returns {Promise<'shared'|'downloaded'|'cancelled'|'error'>}
 */
export async function shareForm(games, picks, options = {}) {
  if (!games || games.length === 0) return 'error';

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const canvas = document.createElement('canvas');
  renderShareCard(canvas, games, picks, options);

  const blob = await canvasToPngBlob(canvas);
  if (!blob) return 'error';

  const filename = 'form-of-the-week.png';
  const file = new File([blob], filename, { type: 'image/png' });
  const shareText = options.name
    ? `${options.name}'s FORM, this week.`
    : SLOGAN + '.';

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({
        files: [file],
        title: SLOGAN,
        text: shareText,
      });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // fall through to download
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
  return 'downloaded';
}

/**
 * Render a "moving" version of the form-of-the-week card to MP4 and share.
 *
 * The chrome (header, picks list, footer) is identical to the still card —
 * only the ink wash breathes, by feeding a slow, looping seed offset into
 * drawField. Falls back gracefully when ffmpeg.wasm is unavailable.
 *
 * @param {object[]} games
 * @param {Record<string, 'left'|'right'>} picks
 * @param {{ weekLabel?: string, name?: string, seconds?: number, fps?: number, onProgress?: (ratio:number)=>void }} options
 * @returns {Promise<'shared'|'downloaded'|'still-fallback'|'unsupported'|'cancelled'|'error'>}
 */
export async function shareFormMoving(games, picks, options = {}) {
  if (!games || games.length === 0) return 'error';

  if (!isFfmpegSupported()) {
    const fallback = await shareForm(games, picks, options);
    return fallback === 'error' ? 'error' : 'still-fallback';
  }

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const fps = Math.max(12, Math.min(30, Number(options.fps) || 24));
  const seconds = Math.max(2, Math.min(8, Number(options.seconds) || 4));
  const frames = Math.round(fps * seconds);

  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;

  let mp4;
  try {
    const { blobs, width, height } = await captureCanvasFrames(
      canvas,
      (_ctx, _i, _n, t) => {
        // Smooth, looping wobble: sine over t ∈ [0,1]
        const seedOffset = Math.round(Math.sin(t * Math.PI * 2) * 60);
        renderShareCard(canvas, games, picks, { ...options, seedOffset });
      },
      { fps, frames },
    );

    mp4 = await encodeFramesToMp4(blobs, {
      width,
      height,
      fps,
      crf: 20,
      onProgress: options.onProgress,
    });
  } catch (err) {
    console.warn('[shareFormMoving] encode failed, falling back to still', err);
    const fallback = await shareForm(games, picks, options);
    return fallback === 'error' ? 'error' : 'still-fallback';
  }

  const filename = 'form-of-the-week.mp4';
  const file = new File([mp4], filename, { type: 'video/mp4' });
  const shareText = options.name
    ? `${options.name}'s FORM, this week.`
    : SLOGAN + '.';

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({
        files: [file],
        title: SLOGAN,
        text: shareText,
      });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }

  downloadBlob(mp4, filename);
  return 'downloaded';
}
