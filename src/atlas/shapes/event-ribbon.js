/**
 * Event ribbon shape — chronological cards laid edge-to-edge.
 *
 * Use for: deal sheets, signing windows, season highlight reels, anything
 * the eye should scan as a sequence of distinct moments. Reads like a tarot
 * spread along the bottom of a page.
 *
 * Dataset shape:
 *   { events: [{ date, title, value?: string, kicker?: string, color?: string }] }
 */

import {
  INK, INK_MUTED, INK_FAINT, CREAM_DEEP,
  paintBackground, drawHairline,
  drawHeader, drawFooter, wrapText, fmtDate, hashString,
} from './_primitives.js';

function parseHex(hex, fallback = '#1a1714') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || fallback).trim());
  if (!m) return fallback;
  return '#' + m[1].toLowerCase();
}

export function renderEventRibbon(canvas, dataset, style = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const events = Array.isArray(dataset.events) ? dataset.events.slice() : [];
  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const seedBase = hashString(events.map((e) => e.date + e.title).join('|') || 'empty');
  paintBackground(ctx, W, H, seedBase + 109);
  drawHeader(ctx, W, style);

  if (events.length === 0) {
    drawFooter(ctx, W, H, style);
    return;
  }

  const padX = Math.max(48, Math.round(W * 0.08));
  const headerH = Math.round(H * 0.22);
  const footerH = Math.round(H * 0.12);
  drawHairline(ctx, padX, headerH, W - padX, headerH, 0.16);

  const ribbonTop = headerH + Math.round(H * 0.05);
  const ribbonBottom = H - footerH - Math.round(H * 0.05);
  const ribbonH = ribbonBottom - ribbonTop;
  const innerW = W - padX * 2;

  const cardCount = events.length;
  const cardW = innerW / cardCount;

  // Spine — single hairline running through the ribbon
  ctx.strokeStyle = `rgba(26,23,20,0.18)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, ribbonTop);
  ctx.lineTo(padX + innerW, ribbonTop);
  ctx.stroke();

  events.forEach((e, i) => {
    const x = padX + i * cardW;
    const w = cardW;
    const cardPad = Math.max(8, Math.round(w * 0.08));
    const swatchH = Math.round(ribbonH * 0.18);

    if (i > 0) {
      ctx.strokeStyle = `rgba(26,23,20,0.12)`;
      ctx.beginPath();
      ctx.moveTo(x, ribbonTop + 2);
      ctx.lineTo(x, ribbonBottom - 2);
      ctx.stroke();
    }

    // Color swatch
    const color = parseHex(e.color, '#487670');
    ctx.fillStyle = color;
    ctx.fillRect(x + cardPad, ribbonTop + 6, w - cardPad * 2, swatchH);

    // Faint card wash
    ctx.fillStyle = `${CREAM_DEEP}`;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + cardPad, ribbonTop + 6 + swatchH, w - cardPad * 2, ribbonH - swatchH - 12);
    ctx.globalAlpha = 1;

    // Date
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 ${Math.round(W * 0.016)}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.18em';
    ctx.fillText(
      fmtDate(e.date, style.dateMode || 'long').toUpperCase(),
      x + cardPad,
      ribbonTop + 6 + swatchH + 12,
    );
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    // Kicker (e.g. "DEAL", "SIGNING")
    if (e.kicker) {
      ctx.fillStyle = INK_MUTED;
      ctx.font = `400 ${Math.round(W * 0.014)}px "Inter", system-ui, sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.22em';
      ctx.fillText(
        String(e.kicker).toUpperCase(),
        x + cardPad,
        ribbonTop + 6 + swatchH + 30,
      );
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }

    // Title
    ctx.fillStyle = INK;
    const titleSize = Math.round(W * 0.022);
    ctx.font = `italic 400 ${titleSize}px "EB Garamond", Georgia, serif`;
    const titleLines = wrapText(ctx, e.title, w - cardPad * 2);
    titleLines.forEach((ln, k) => {
      ctx.fillText(ln, x + cardPad, ribbonTop + 6 + swatchH + 50 + k * (titleSize * 1.2));
    });

    // Value (e.g. "$2.2B", "8 yrs / $28M")
    if (e.value) {
      ctx.fillStyle = INK;
      const vSize = Math.round(W * 0.028);
      ctx.font = `400 ${vSize}px "Cormorant Garamond", Georgia, serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(e.value), x + cardPad, ribbonBottom - 12);
    }
  });

  drawFooter(ctx, W, H, style);

  void INK_MUTED;
}
