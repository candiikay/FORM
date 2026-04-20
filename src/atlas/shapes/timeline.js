/**
 * Timeline shape — annotated horizontal ink hairline.
 *
 * Built only from Atlas drawing primitives so every Timeline plate
 * looks like it was set on the same press.
 */

import {
  INK, INK_MUTED, INK_FAINT,
  paintBackground, drawHairline, drawWobblyLine,
  drawHeader, drawFooter,
  wrapText, fmtDate, hashString,
} from './_primitives.js';

export function renderTimeline(canvas, dataset, style = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const events = Array.isArray(dataset.events) ? dataset.events.slice() : [];
  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (events.length === 0) {
    paintBackground(ctx, W, H, 11);
    drawHeader(ctx, W, style);
    drawFooter(ctx, W, H, style);
    return;
  }

  const seedBase = hashString(events.map((e) => e.date + e.title).join('|'));
  paintBackground(ctx, W, H, seedBase + 17);
  drawHeader(ctx, W, style);

  const padX = Math.max(48, Math.round(W * 0.08));
  const headerH = Math.round(H * 0.22);
  const axisY = Math.round(H * 0.55);

  drawHairline(ctx, padX, headerH, W - padX, headerH, 0.16);

  const axisX1 = padX;
  const axisX2 = W - padX;
  drawWobblyLine(ctx, axisX1, axisX2, axisY, seedBase + 41, 0.55);

  const startIso = dataset.domain?.[0] || events[0].date;
  const endIso = dataset.domain?.[1] || events[events.length - 1].date;
  const startTs = new Date(startIso).getTime();
  const endTs = new Date(endIso).getTime();
  const span = Math.max(1, endTs - startTs);

  const dateMode = style.dateMode || 'year';

  // Year ticks
  const startYear = new Date(startIso).getFullYear();
  const endYear = new Date(endIso).getFullYear();
  const yearSpan = endYear - startYear;
  const tickStep = yearSpan > 80 ? 10 : yearSpan > 30 ? 5 : 2;
  const tickFontSize = Math.round(W * 0.018);
  ctx.fillStyle = INK_FAINT;
  ctx.font = `400 ${tickFontSize}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  for (let y = Math.ceil(startYear / tickStep) * tickStep; y <= endYear; y += tickStep) {
    const yTs = new Date(`${y}-01-01`).getTime();
    const t = (yTs - startTs) / span;
    if (t < 0 || t > 1) continue;
    const x = axisX1 + (axisX2 - axisX1) * t;
    ctx.strokeStyle = `rgba(26,23,20,0.22)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, axisY - 4);
    ctx.lineTo(x, axisY + 4);
    ctx.stroke();
    ctx.fillText(String(y), x, axisY + 22);
  }

  // Event markers + alternating labels
  const labelFontSize = Math.round(W * 0.024);
  const dateFontSize = Math.round(W * 0.018);
  const labelMaxW = Math.max(80, Math.round(W * 0.16));
  const dropTop = Math.round(H * 0.08);
  const dropBottom = Math.round(H * 0.08);

  events.forEach((e, i) => {
    const ts = new Date(e.date).getTime();
    const t = (ts - startTs) / span;
    if (t < -0.02 || t > 1.02) return;
    const x = axisX1 + (axisX2 - axisX1) * Math.min(1, Math.max(0, t));
    const above = i % 2 === 0;
    const dropEnd = above ? axisY - 24 - dropTop : axisY + 24 + dropBottom;
    const labelY = above ? dropEnd - 6 : dropEnd + labelFontSize + 4;
    const dateY = above ? labelY - labelFontSize - 6 : labelY + labelFontSize + 4;

    drawHairline(ctx, x, axisY + (above ? -6 : 6), x, dropEnd, 0.28);

    ctx.fillStyle = e.palette?.[0] || INK;
    ctx.beginPath();
    ctx.arc(x, axisY, 3.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `400 ${dateFontSize}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = INK_FAINT;
    ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.18em';
    ctx.fillText(fmtDate(e.date, dateMode).toUpperCase(), x, dateY);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    ctx.font = `italic 400 ${labelFontSize}px "EB Garamond", Georgia, serif`;
    ctx.fillStyle = INK;
    const lines = wrapText(ctx, e.title, labelMaxW);
    const lineH = Math.round(labelFontSize * 1.18);
    lines.forEach((ln, k) => {
      const y = above
        ? labelY - (lines.length - 1 - k) * lineH
        : labelY + k * lineH;
      ctx.fillText(ln, x, y);
    });
  });

  drawFooter(ctx, W, H, style);

  // unused ref kept to satisfy lint scanners that flag side-effect-only imports
  void INK_MUTED;
}
