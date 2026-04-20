/** Shared canvas primitives for Atlas shapes.
 *
 * Every Atlas Shape draws onto the same paper with the same rules:
 * cream background with deterministic flecks, ink hairlines, italic serif
 * labels, sans-serif kickers, citation footer. Living here means a new
 * Shape never has to rethink the visual language.
 */

export const CREAM = '#ede8e0';
export const CREAM_DEEP = '#e4ddd2';
export const INK = '#1a1714';
export const INK_MUTED = '#6b6560';
export const INK_FAINT = '#b8b0a8';

export const STROKE_TEAL = 'rgba(72, 118, 112, 0.85)';
export const STROKE_SAND = 'rgba(196, 172, 138, 0.85)';
export const STROKE_CLAY = 'rgba(178, 98, 68, 0.85)';

export const PALETTES = {
  ink: ['#1a1714', '#6b6560', '#b8b0a8'],
  teal: ['#487670', '#88a8a3', '#c4d6d3'],
  sand: ['#c4ac8a', '#9c8a6e', '#6e6450'],
  clay: ['#b26244', '#7a3e2a', '#3f1f12'],
  duo: ['#487670', '#b26244', '#1a1714'],
  cinema: ['#1a1714', '#bf3a2c', '#dccfb6'],
};

export function paletteByName(name) {
  return PALETTES[name] || PALETTES.ink;
}

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function paintBackground(ctx, W, H, seed) {
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  const rand = mulberry32(seed);
  const fleckCount = Math.floor((W * H) / 700);
  for (let i = 0; i < fleckCount; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const a = 0.025 + rand() * 0.07;
    ctx.fillStyle = `rgba(26,23,20,${a})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

export function drawHairline(ctx, x1, y1, x2, y2, alpha = 0.18) {
  ctx.save();
  ctx.strokeStyle = `rgba(26,23,20,${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function drawWobblyLine(ctx, x1, x2, y, seed, alpha = 0.55) {
  const rand = mulberry32(seed);
  const segs = Math.max(40, Math.floor((x2 - x1) / 18));
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = x1 + (x2 - x1) * t;
    const wob = (rand() - 0.5) * 1.2;
    if (i === 0) ctx.moveTo(x, y + wob);
    else ctx.lineTo(x, y + wob);
  }
  ctx.strokeStyle = `rgba(26,23,20,${alpha})`;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function fmtDate(iso, mode = 'year') {
  if (!iso) return '';
  if (mode === 'year') return String(iso).slice(0, 4);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 4);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Standard plate header — kicker / title / subtitle / hairline. */
export function drawHeader(ctx, W, style) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const padX = Math.max(48, Math.round(W * 0.08));

  if (style.kicker) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `400 ${Math.round(W * 0.022)}px "Inter", system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.32em';
    ctx.fillText(String(style.kicker).toUpperCase(), padX, Math.round(W * 0.05));
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  if (style.title) {
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(W * 0.07)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText(style.title, padX, Math.round(W * 0.11));
  }

  if (style.subtitle) {
    ctx.fillStyle = INK_MUTED;
    ctx.font = `italic 400 ${Math.round(W * 0.028)}px "EB Garamond", Georgia, serif`;
    ctx.fillText(style.subtitle, padX, Math.round(W * 0.145));
  }
}

/** Standard footer — wordmark + citation. */
export function drawFooter(ctx, W, H, style) {
  const padX = Math.max(48, Math.round(W * 0.08));
  drawHairline(ctx, padX, H - Math.round(H * 0.085), W - padX, H - Math.round(H * 0.085), 0.14);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `300 ${Math.round(W * 0.022)}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillStyle = INK;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.3em';
  ctx.fillText('FORM ATLAS', padX, H - Math.round(H * 0.04));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  ctx.textAlign = 'right';
  ctx.font = `400 ${Math.round(W * 0.016)}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = INK_FAINT;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0.18em';
  const citation = style.citation || 'Source: composite · FORM Atlas';
  ctx.fillText(citation.toUpperCase(), W - padX, H - Math.round(H * 0.04));
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/** Caption strip below header / above footer body. */
export function drawCaption(ctx, W, y, text) {
  if (!text) return;
  const padX = Math.max(48, Math.round(W * 0.08));
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `italic 400 ${Math.round(W * 0.026)}px "EB Garamond", Georgia, serif`;
  ctx.fillStyle = INK_MUTED;
  const lines = wrapText(ctx, text, W - padX * 2);
  const lineH = Math.round(W * 0.034);
  lines.forEach((ln, i) => ctx.fillText(ln, padX, y + i * lineH));
}
