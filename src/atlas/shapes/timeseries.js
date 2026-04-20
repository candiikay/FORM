/**
 * Timeseries shape — a single hand-drawn ink stroke through ordered points.
 *
 * Use for: career arcs, season momentum, weekly form, viewership growth.
 * Dataset shape: { points: [{ x: number|date, y: number, label?: string }] }
 *
 * The line is rendered as a soft bezier through the points with an under-shadow
 * watercolour ghost so the curve reads as a brush stroke, not a chart line.
 */

import {
  INK, INK_MUTED, INK_FAINT,
  paintBackground, drawHairline,
  drawHeader, drawFooter, drawCaption,
  hashString,
} from './_primitives.js';

function toNumber(x) {
  if (typeof x === 'number') return x;
  if (x instanceof Date) return x.getTime();
  const t = new Date(x).getTime();
  return Number.isFinite(t) ? t : Number(x);
}

export function renderTimeseries(canvas, dataset, style = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const points = Array.isArray(dataset.points) ? dataset.points.slice() : [];
  points.sort((a, b) => toNumber(a.x) - toNumber(b.x));

  const seedBase = hashString(points.map((p) => `${p.x}:${p.y}`).join('|') || 'empty');
  paintBackground(ctx, W, H, seedBase + 31);
  drawHeader(ctx, W, style);

  if (points.length < 2) {
    drawCaption(ctx, W, Math.round(H * 0.5), 'Not enough data to draw a line.');
    drawFooter(ctx, W, H, style);
    return;
  }

  const padX = Math.max(48, Math.round(W * 0.08));
  const headerH = Math.round(H * 0.22);
  const footerH = Math.round(H * 0.12);
  const plotTop = headerH + Math.round(H * 0.05);
  const plotBottom = H - footerH - Math.round(H * 0.05);
  const plotLeft = padX;
  const plotRight = W - padX;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  drawHairline(ctx, padX, headerH, W - padX, headerH, 0.16);

  // Frame
  ctx.strokeStyle = `rgba(26,23,20,0.18)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();

  const xs = points.map((p) => toNumber(p.x));
  const ys = points.map((p) => Number(p.y) || 0);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin || 1;
  const yMaxRaw = Math.max(...ys);
  const yMinRaw = Math.min(0, ...ys);
  const yPadTop = Math.max(yMaxRaw * 0.08, 1);
  const yMax = yMaxRaw + yPadTop;
  const yMin = yMinRaw;
  const yRange = yMax - yMin || 1;

  function px(p) {
    return plotLeft + ((toNumber(p.x) - xMin) / xRange) * plotW;
  }
  function py(p) {
    return plotBottom - ((Number(p.y) - yMin) / yRange) * plotH;
  }

  // Reference rules
  ctx.font = `400 ${Math.round(W * 0.016)}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = INK_FAINT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.16em';
  for (let i = 0; i <= 4; i++) {
    const v = yMin + ((yMax - yMin) * (4 - i)) / 4;
    const y = plotTop + (plotH * i) / 4;
    ctx.strokeStyle = `rgba(26,23,20,0.05)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), plotLeft - 6, y);
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // Ghost shadow stroke (slight offset, low alpha) — gives the brushstroke feel
  ctx.save();
  ctx.strokeStyle = `rgba(26,23,20,0.12)`;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = px(p);
    const y = py(p) + 2;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const prev = points[i - 1];
      const ppx = px(prev);
      const ppy = py(prev) + 2;
      const cx1 = ppx + (x - ppx) * 0.5;
      const cy1 = ppy;
      const cx2 = x - (x - ppx) * 0.5;
      const cy2 = y;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
    }
  });
  ctx.stroke();
  ctx.restore();

  // Main ink stroke
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.6, W * 0.0035);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = px(p);
    const y = py(p);
    if (i === 0) ctx.moveTo(x, y);
    else {
      const prev = points[i - 1];
      const ppx = px(prev);
      const ppy = py(prev);
      const cx1 = ppx + (x - ppx) * 0.5;
      const cy1 = ppy;
      const cx2 = x - (x - ppx) * 0.5;
      const cy2 = y;
      ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x, y);
    }
  });
  ctx.stroke();

  // Endpoint emphasis
  const last = points[points.length - 1];
  const lx = px(last);
  const ly = py(last);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(lx, ly, Math.max(2.6, W * 0.005), 0, Math.PI * 2);
  ctx.fill();

  if (style.endLabel || last.label) {
    ctx.font = `italic 400 ${Math.round(W * 0.024)}px "EB Garamond", Georgia, serif`;
    ctx.fillStyle = INK_MUTED;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(style.endLabel || last.label), lx - 6, ly - 8);
  }

  // X axis tick labels — first / mid / last
  ctx.font = `400 ${Math.round(W * 0.016)}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = INK_FAINT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.18em';
  function tickLabel(p) {
    if (p.label && style.useLabelsOnAxis) return String(p.label);
    if (typeof p.x === 'string') return String(p.x).slice(0, 4);
    if (p.x instanceof Date) return String(p.x.getFullYear());
    return String(Math.round(toNumber(p)));
  }
  const ticks = [points[0], points[Math.floor(points.length / 2)], last];
  ticks.forEach((p) => {
    ctx.fillText(tickLabel(p).toUpperCase(), px(p), plotBottom + 6);
  });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  if (style.caption) {
    drawCaption(ctx, W, plotBottom + Math.round(H * 0.06), style.caption);
  }

  drawFooter(ctx, W, H, style);
}
