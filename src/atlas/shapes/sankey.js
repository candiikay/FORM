/**
 * Sankey shape — flow of value from sources to destinations.
 *
 * Use for: media-rights deals split across networks, league revenue → buckets,
 * sponsorship dollars by sponsor, ticket revenue by team.
 *
 * Dataset shape:
 *   {
 *     sources: [{ id, label, magnitude }],
 *     targets: [{ id, label, magnitude? }],
 *     flows:   [{ from: sourceId, to: targetId, magnitude, color? }]
 *   }
 *
 * Drawn as ink hairlines with watercolour fills so it reads like a hand-set
 * editorial diagram, not a D3 default.
 */

import {
  INK, INK_MUTED, INK_FAINT, CREAM,
  paintBackground, drawHairline,
  drawHeader, drawFooter, drawCaption,
  hashString, mulberry32,
} from './_primitives.js';

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return { r: 90, g: 110, b: 118 };
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function rgba({ r, g, b }, a) {
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}

export function renderSankey(canvas, dataset, style = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const sources = Array.isArray(dataset.sources) ? dataset.sources : [];
  const targets = Array.isArray(dataset.targets) ? dataset.targets : [];
  const flows   = Array.isArray(dataset.flows)   ? dataset.flows   : [];

  const seedBase = hashString(
    sources.map((s) => s.id).join(',') + '|' + targets.map((t) => t.id).join(','),
  );
  paintBackground(ctx, W, H, seedBase + 73);
  drawHeader(ctx, W, style);

  if (sources.length === 0 || targets.length === 0 || flows.length === 0) {
    drawCaption(ctx, W, Math.round(H * 0.5), 'Need sources, targets, and flows.');
    drawFooter(ctx, W, H, style);
    return;
  }

  const padX = Math.max(48, Math.round(W * 0.08));
  const headerH = Math.round(H * 0.22);
  const footerH = Math.round(H * 0.12);
  const top = headerH + Math.round(H * 0.04);
  const bottom = H - footerH - Math.round(H * 0.04);
  const colW = Math.round(W * 0.16);
  const leftCol = padX;
  const rightCol = W - padX - colW;
  const flowL = leftCol + colW;
  const flowR = rightCol;

  drawHairline(ctx, padX, headerH, W - padX, headerH, 0.16);

  const totalSrc = sources.reduce((s, x) => s + (Number(x.magnitude) || 0), 0) || 1;
  const totalTgt = targets.reduce((s, x) => s + (Number(x.magnitude) || 0), 0)
    || flows.reduce((s, f) => s + (Number(f.magnitude) || 0), 0)
    || 1;

  const innerH = bottom - top;
  const gap = Math.max(4, Math.round(innerH * 0.02));

  function layout(items, total) {
    const usable = innerH - gap * (items.length - 1);
    let cursor = top;
    return items.map((it) => {
      const h = Math.max(6, ((Number(it.magnitude) || 0) / total) * usable);
      const rect = { y: cursor, h };
      cursor += h + gap;
      return rect;
    });
  }

  const srcRects = layout(sources, totalSrc);
  const tgtRects = layout(targets.length ? targets : sources, totalTgt);

  // Source bars
  sources.forEach((s, i) => {
    const r = srcRects[i];
    const c = parseHex(s.color || '#1a1714');
    ctx.fillStyle = rgba(c, 0.85);
    ctx.fillRect(leftCol, r.y, colW, r.h);
    ctx.fillStyle = CREAM;
    ctx.font = `400 ${Math.round(W * 0.018)}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.18em';
    ctx.fillText(String(s.label || s.id).toUpperCase(), leftCol + colW - 8, r.y + r.h / 2);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  });

  // Target bars
  targets.forEach((t, i) => {
    const r = tgtRects[i];
    const c = parseHex(t.color || '#1a1714');
    ctx.fillStyle = rgba(c, 0.85);
    ctx.fillRect(rightCol, r.y, colW, r.h);
    ctx.fillStyle = CREAM;
    ctx.font = `400 ${Math.round(W * 0.018)}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.18em';
    ctx.fillText(String(t.label || t.id).toUpperCase(), rightCol + 8, r.y + r.h / 2);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  });

  // Flows — render in order, allocating from top of each side
  const sIdx = Object.fromEntries(sources.map((s, i) => [s.id, i]));
  const tIdx = Object.fromEntries(targets.map((t, i) => [t.id, i]));
  const sCursor = sources.map((_, i) => srcRects[i].y);
  const tCursor = targets.map((_, i) => tgtRects[i].y);
  const rand = mulberry32(seedBase + 113);

  flows.forEach((f) => {
    const si = sIdx[f.from];
    const ti = tIdx[f.to];
    if (si == null || ti == null) return;
    const srcRect = srcRects[si];
    const tgtRect = tgtRects[ti];
    const srcMag = Number(sources[si].magnitude) || 1;
    const tgtMag = Number(targets[ti].magnitude) || 1;
    const w1 = Math.max(2, ((Number(f.magnitude) || 0) / srcMag) * srcRect.h);
    const w2 = Math.max(2, ((Number(f.magnitude) || 0) / tgtMag) * tgtRect.h);
    const y1 = sCursor[si];
    const y2 = tCursor[ti];
    sCursor[si] += w1;
    tCursor[ti] += w2;

    const c = parseHex(
      f.color || sources[si].color || targets[ti].color || '#487670',
    );
    const a = 0.28 + rand() * 0.18;

    const cx1 = flowL + (flowR - flowL) * 0.5;
    const cx2 = cx1;

    ctx.beginPath();
    ctx.moveTo(flowL, y1);
    ctx.bezierCurveTo(cx1, y1, cx2, y2, flowR, y2);
    ctx.lineTo(flowR, y2 + w2);
    ctx.bezierCurveTo(cx2, y2 + w2, cx1, y1 + w1, flowL, y1 + w1);
    ctx.closePath();
    ctx.fillStyle = rgba(c, a);
    ctx.fill();
    ctx.strokeStyle = rgba({ r: 26, g: 23, b: 20 }, 0.18);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  });

  if (style.caption) drawCaption(ctx, W, bottom + Math.round(H * 0.04), style.caption);
  drawFooter(ctx, W, H, style);

  void INK; void INK_MUTED; void INK_FAINT;
}
