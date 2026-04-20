/** Atlas Shape: quote-card — a single voice held in ink.
 *
 * The People pillar's signature shape. One quote, one speaker, one moment.
 * Designed to feel like a museum wall card — deeply legible, generously
 * spaced, with the speaker's name and context anchoring the bottom.
 */

import {
  CREAM_DEEP, INK, INK_MUTED, INK_FAINT,
  paintBackground, drawHairline,
  drawHeader, drawFooter,
  wrapText, fmtDate, hashString,
} from './_primitives.js';

function pickQuote(dataset) {
  if (Array.isArray(dataset?.quotes) && dataset.quotes.length) return dataset.quotes[0];
  if (Array.isArray(dataset?.events) && dataset.events.length) {
    const e = dataset.events.find((it) => it.quote) || dataset.events[0];
    return {
      quote: e.quote || e.title || '',
      speaker: e.speaker || '',
      context: e.context || '',
      date: e.date || '',
      source: e.source || '',
    };
  }
  return null;
}

function fitFont(ctx, text, maxWidth, maxLines, startPx, minPx) {
  let size = startPx;
  while (size >= minPx) {
    ctx.font = `italic 400 ${size}px "EB Garamond", Georgia, serif`;
    const lines = wrapText(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
    size -= 2;
  }
  ctx.font = `italic 400 ${minPx}px "EB Garamond", Georgia, serif`;
  return { size: minPx, lines: wrapText(ctx, text, maxWidth) };
}

export function renderQuoteCard(canvas, dataset, style = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const q = pickQuote(dataset);
  const seed = hashString(JSON.stringify({ s: q?.speaker || '', t: style.title || '' }));

  paintBackground(ctx, W, H, seed);
  drawHeader(ctx, W, style);

  const padX = Math.max(60, Math.round(W * 0.1));
  const innerW = W - padX * 2;
  const top = Math.round(W * 0.22);
  const bottom = H - Math.round(H * 0.14);

  if (!q) {
    ctx.fillStyle = INK_MUTED;
    ctx.textAlign = 'center';
    ctx.font = `italic 400 ${Math.round(W * 0.04)}px "EB Garamond", Georgia, serif`;
    ctx.fillText('No quote selected.', W / 2, (top + bottom) / 2);
    drawFooter(ctx, W, H, style);
    return;
  }

  // Big opening quote mark, bookended by a small closing one — set in
  // outline-style alpha so the type is the hero, not the punctuation.
  ctx.save();
  ctx.fillStyle = `rgba(26,23,20,0.10)`;
  ctx.font = `400 ${Math.round(W * 0.32)}px "Cormorant Garamond", Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('\u201C', padX - Math.round(W * 0.04), top - Math.round(W * 0.06));
  ctx.restore();

  // The quote — italic, generous leading, fit-to-box
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const startSize = Math.round(W * 0.07);
  const minSize = Math.round(W * 0.034);
  const { size: quoteSize, lines } = fitFont(ctx, q.quote || '', innerW, 6, startSize, minSize);
  const lineH = Math.round(quoteSize * 1.28);
  const quoteH = lines.length * lineH;
  const usableH = bottom - top - Math.round(W * 0.22);
  const quoteTop = top + Math.max(0, Math.round((usableH - quoteH) / 2));

  ctx.font = `italic 400 ${quoteSize}px "EB Garamond", Georgia, serif`;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, padX, quoteTop + (i + 1) * lineH);
  });

  // Closing mark, sized to the quote
  ctx.save();
  ctx.fillStyle = `rgba(26,23,20,0.10)`;
  ctx.font = `400 ${Math.round(quoteSize * 2.4)}px "Cormorant Garamond", Georgia, serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('\u201D', W - padX + Math.round(W * 0.04), quoteTop + quoteH - Math.round(quoteSize * 0.4));
  ctx.restore();

  // Attribution block — speaker, date, context
  const attrTop = quoteTop + quoteH + Math.round(W * 0.05);
  drawHairline(ctx, padX, attrTop, padX + Math.round(innerW * 0.3), attrTop, 0.32);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (q.speaker) {
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(W * 0.034)}px "Cormorant Garamond", Georgia, serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.16em';
    ctx.fillText(`\u2014 ${String(q.speaker).toUpperCase()}`, padX, attrTop + Math.round(W * 0.05));
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  const meta = [q.date ? fmtDate(q.date, 'long') : '', q.context || ''].filter(Boolean).join(' \u00b7 ');
  if (meta) {
    ctx.fillStyle = INK_MUTED;
    ctx.font = `italic 400 ${Math.round(W * 0.024)}px "EB Garamond", Georgia, serif`;
    const metaLines = wrapText(ctx, meta, innerW);
    metaLines.slice(0, 2).forEach((ln, i) => {
      ctx.fillText(ln, padX, attrTop + Math.round(W * 0.085) + i * Math.round(W * 0.034));
    });
  }

  if (q.source) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 ${Math.round(W * 0.018)}px "Inter", system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.22em';
    ctx.fillText(String(q.source).toUpperCase(), padX, attrTop + Math.round(W * 0.16));
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  drawFooter(ctx, W, H, style);

  void CREAM_DEEP;
}
