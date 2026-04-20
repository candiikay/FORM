/** Atlas Shape: treemap — proportional rectangles for "share of" stories.
 *
 * Pairs naturally with cross-pillar Subjects (e.g. Money flowing into salary
 * tiers, People → titles by program). Uses a squarified-treemap layout
 * (Bruls et al. 2000) for stable, readable rectangles.
 */

import {
  CREAM, INK, INK_MUTED, INK_FAINT,
  paintBackground, drawHairline,
  drawHeader, drawFooter, drawCaption,
  wrapText, hashString,
} from './_primitives.js';

function squarify(items, x, y, w, h) {
  const total = items.reduce((s, it) => s + Math.max(0, Number(it.value) || 0), 0);
  const rects = [];
  if (total <= 0 || items.length === 0) return rects;

  // Scale values to fit area
  const area = w * h;
  const scale = area / total;
  const queue = items.map((it) => ({
    item: it,
    area: Math.max(1, (Number(it.value) || 0) * scale),
  })).sort((a, b) => b.area - a.area);

  let curX = x;
  let curY = y;
  let curW = w;
  let curH = h;

  function worst(row, length) {
    const sum = row.reduce((s, r) => s + r.area, 0);
    let max = -Infinity;
    let min = Infinity;
    for (const r of row) {
      max = Math.max(max, r.area);
      min = Math.min(min, r.area);
    }
    const s2 = length * length;
    const sumSq = sum * sum;
    return Math.max((s2 * max) / sumSq, sumSq / (s2 * min));
  }

  function layoutRow(row, isHorizontal) {
    const sum = row.reduce((s, r) => s + r.area, 0);
    if (isHorizontal) {
      const rowH = sum / curW;
      let cx = curX;
      for (const r of row) {
        const rw = r.area / rowH;
        rects.push({ item: r.item, x: cx, y: curY, w: rw, h: rowH });
        cx += rw;
      }
      curY += rowH;
      curH -= rowH;
    } else {
      const rowW = sum / curH;
      let cy = curY;
      for (const r of row) {
        const rh = r.area / rowW;
        rects.push({ item: r.item, x: curX, y: cy, w: rowW, h: rh });
        cy += rh;
      }
      curX += rowW;
      curW -= rowW;
    }
  }

  let row = [];
  while (queue.length > 0) {
    const isHorizontal = curW >= curH;
    const length = isHorizontal ? curW : curH;
    const next = queue[0];
    if (row.length === 0) { row.push(queue.shift()); continue; }
    const withNext = row.concat(next);
    if (worst(row, length) >= worst(withNext, length)) {
      row.push(queue.shift());
    } else {
      layoutRow(row, isHorizontal);
      row = [];
    }
  }
  if (row.length) layoutRow(row, curW >= curH);

  return rects;
}

export function renderTreemap(canvas, dataset, style = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const seed = hashString(JSON.stringify({ ds: dataset?.points?.length || 0, t: style.title || '' }));

  paintBackground(ctx, W, H, seed);
  drawHeader(ctx, W, style);

  const padX = Math.max(48, Math.round(W * 0.08));
  const headerBottom = Math.round(W * 0.18);
  const footerTop = H - Math.round(H * 0.12);

  if (style.subtitle && style.subtitleAsCaption) {
    drawCaption(ctx, W, Math.round(W * 0.18), style.subtitle);
  }

  const items = Array.isArray(dataset?.points) && dataset.points.length
    ? dataset.points
    : [{ id: 'empty', label: 'No data', value: 1 }];

  const rectArea = {
    x: padX,
    y: headerBottom + Math.round(W * 0.02),
    w: W - padX * 2,
    h: footerTop - (headerBottom + Math.round(W * 0.02)) - Math.round(W * 0.04),
  };

  const rects = squarify(items, rectArea.x, rectArea.y, rectArea.w, rectArea.h);

  rects.forEach((r) => {
    const color = r.item.color || (r.item.value >= 0 ? '#1a1714' : '#b26244');
    const alpha = r.item.alpha ?? 0.18;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();

    drawHairline(ctx, r.x, r.y, r.x + r.w, r.y, 0.22);
    drawHairline(ctx, r.x, r.y, r.x, r.y + r.h, 0.22);
    drawHairline(ctx, r.x + r.w, r.y, r.x + r.w, r.y + r.h, 0.18);
    drawHairline(ctx, r.x, r.y + r.h, r.x + r.w, r.y + r.h, 0.18);

    const labelPad = Math.min(14, Math.max(6, Math.round(r.w * 0.06)));
    const minDimForLabel = 56;
    if (r.w < minDimForLabel || r.h < minDimForLabel) return;

    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `400 ${Math.round(Math.min(r.w, r.h) * 0.12)}px "Cormorant Garamond", Georgia, serif`;
    const labelLines = wrapText(ctx, r.item.label || '', r.w - labelPad * 2);
    const lineH = Math.round(Math.min(r.w, r.h) * 0.14);
    labelLines.slice(0, 3).forEach((ln, i) => {
      ctx.fillText(ln, r.x + labelPad, r.y + labelPad + i * lineH);
    });

    if (r.item.kicker) {
      ctx.fillStyle = INK_FAINT;
      ctx.font = `400 ${Math.max(9, Math.round(Math.min(r.w, r.h) * 0.05))}px "Inter", system-ui, sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.18em';
      ctx.fillText(String(r.item.kicker).toUpperCase(), r.x + labelPad, r.y + r.h - labelPad - Math.round(Math.min(r.w, r.h) * 0.06));
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }

    if (r.item.value && r.item.showValue !== false) {
      ctx.fillStyle = INK_MUTED;
      ctx.font = `italic 400 ${Math.max(11, Math.round(Math.min(r.w, r.h) * 0.08))}px "EB Garamond", Georgia, serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const valStr = r.item.valueLabel || String(r.item.value);
      ctx.fillText(valStr, r.x + r.w - labelPad, r.y + r.h - labelPad);
    }
  });

  drawFooter(ctx, W, H, style);

  if (style.note) {
    ctx.fillStyle = INK_MUTED;
    ctx.font = `italic 400 ${Math.round(W * 0.022)}px "EB Garamond", Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.fillText(style.note, padX, footerTop + Math.round(H * 0.025));
  }
  // Touch CREAM so it isn't unused (background already painted).
  void CREAM;
}
