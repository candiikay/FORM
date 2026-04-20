/**
 * Palette Stack shape — vertical stack of color swatches.
 *
 * Use for: career-decade palettes, era overviews, ownership-color summaries.
 * Dataset shape: { bands: [{ label: string, sublabel?: string, color: string|string[], magnitude?: number }] }
 *
 * Each band height can be uniform or weighted by magnitude. Inside each band we
 * paint a soft watercolour wash so swatches read as pigment, not flat fills.
 */

import {
  CREAM, INK, INK_MUTED, INK_FAINT,
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

function rgba(rgb, a) {
  return `rgba(${rgb.r | 0},${rgb.g | 0},${rgb.b | 0},${a})`;
}

function paintSwatch(ctx, x, y, w, h, colorHex, seed) {
  const rgb = parseHex(colorHex);
  ctx.save();
  ctx.fillStyle = rgba(rgb, 0.92);
  ctx.fillRect(x, y, w, h);

  // Watercolour pooling — random low-opacity ovals seeded by band index
  const rand = mulberry32(seed);
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 22; i++) {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    const rx = w * (0.08 + rand() * 0.18);
    const ry = h * (0.18 + rand() * 0.4);
    const a = 0.05 + rand() * 0.12;
    ctx.fillStyle = rgba({
      r: Math.max(0, rgb.r - 20),
      g: Math.max(0, rgb.g - 20),
      b: Math.max(0, rgb.b - 20),
    }, a);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Top edge tide line (drying watercolour)
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = rgba({
    r: Math.max(0, rgb.r - 35),
    g: Math.max(0, rgb.g - 35),
    b: Math.max(0, rgb.b - 35),
  }, 0.32);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y + 0.5);
  ctx.lineTo(x + w, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

export function renderPaletteStack(canvas, dataset, style = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const bands = Array.isArray(dataset.bands) ? dataset.bands : [];
  const seedBase = hashString(bands.map((b) => `${b.label}:${b.color}`).join('|') || 'empty');

  paintBackground(ctx, W, H, seedBase + 53);
  drawHeader(ctx, W, style);

  if (bands.length === 0) {
    drawCaption(ctx, W, Math.round(H * 0.5), 'No bands provided.');
    drawFooter(ctx, W, H, style);
    return;
  }

  const padX = Math.max(48, Math.round(W * 0.08));
  const headerH = Math.round(H * 0.22);
  const footerH = Math.round(H * 0.12);
  const top = headerH + Math.round(H * 0.04);
  const bottom = H - footerH - Math.round(H * 0.04);
  const stackH = bottom - top;
  const stackLeft = padX;
  const stackW = Math.round(W * 0.42);
  const stackRight = stackLeft + stackW;
  const labelLeft = stackRight + Math.round(W * 0.04);

  drawHairline(ctx, padX, headerH, W - padX, headerH, 0.16);

  const totalMag = bands.reduce((sum, b) => sum + (Number(b.magnitude) || 1), 0);
  let cursorY = top;

  bands.forEach((band, i) => {
    const mag = Number(band.magnitude) || 1;
    const h = (mag / totalMag) * stackH;
    const color = Array.isArray(band.color) ? band.color[0] : band.color || '#1a1714';
    paintSwatch(ctx, stackLeft, cursorY, stackW, h, color, seedBase + i * 13);

    // Label column
    const midY = cursorY + h / 2;
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 ${Math.round(W * 0.018)}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.22em';
    if (band.sublabel) {
      ctx.fillText(String(band.sublabel).toUpperCase(), labelLeft, midY - Math.round(W * 0.018));
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(W * 0.034)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(String(band.label), labelLeft, midY + Math.round(W * 0.006));

    if (band.note) {
      ctx.fillStyle = INK_MUTED;
      ctx.font = `italic 400 ${Math.round(W * 0.022)}px "EB Garamond", Georgia, serif`;
      ctx.fillText(String(band.note), labelLeft, midY + Math.round(W * 0.034));
    }

    cursorY += h;
  });

  drawFooter(ctx, W, H, style);
  void CREAM;
}
