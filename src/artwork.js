/**
 * Single-field generative ink wash.
 * ONE canvas holds all matchups — strokes bleed across game boundaries.
 */

import { artPaletteForPick } from './api.js';

function n(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function hash2(ix, iy, s) {
  const v = Math.sin(ix * 12.9898 + iy * 78.233 + s * 0.001) * 43758.5453;
  return v - Math.floor(v);
}

function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const u = tx * tx * (3 - 2 * tx);
  const v = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const i1 = a + (b - a) * u;
  const i2 = c + (d - c) * u;
  return i1 + (i2 - i1) * v;
}

function fbm2(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise2D(x * freq + o * 3.1, y * freq + o * 2.7, seed + o * 19.7) * amp;
    norm += amp;
    amp *= 0.52;
    freq *= 2.05;
  }
  return sum / norm;
}

function parseHexColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return { r: 90, g: 110, b: 118 };
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function muteWash(rgb, amount) {
  const lum = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return {
    r: mix(rgb.r, lum, amount),
    g: mix(rgb.g, lum, amount),
    b: mix(rgb.b, lum, amount),
  };
}

function shade(rgb, factor, add = 0) {
  return {
    r: Math.max(0, Math.min(255, rgb.r * factor + add)),
    g: Math.max(0, Math.min(255, rgb.g * factor + add)),
    b: Math.max(0, Math.min(255, rgb.b * factor + add)),
  };
}

function rgba(rgb, a) {
  return `rgba(${rgb.r | 0},${rgb.g | 0},${rgb.b | 0},${a})`;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function drawPaperGrain(ctx, W, H, seed) {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = 0.045;
  const step = Math.max(3, Math.floor(Math.min(W, H) / 28));
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (n(seed + x * 0.1 + y * 0.07) > 0.55) {
        ctx.fillStyle = `rgba(26,23,20,${0.15 + n(seed + x + y) * 0.35})`;
        const jx = (n(seed + x * 2.2) - 0.5) * step * 0.8;
        const jy = (n(seed + y * 1.7) - 0.5) * step * 0.8;
        ctx.fillRect(x + jx, y + jy, 1.2, 1.2);
      }
    }
  }
  ctx.globalAlpha = prev;
}

function ellipsePoint(cx, cy, rx, ry, rot, t, seed, rNoise) {
  const ang = t * Math.PI * 2;
  const nx = fbm2(Math.cos(ang) * 2.2 + seed, Math.sin(ang) * 2.2, seed + 41, 3);
  const mul = 0.86 + nx * rNoise;
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const ex = rx * mul * Math.cos(ang);
  const ey = ry * mul * Math.sin(ang);
  return {
    x: cx + ex * ca - ey * sa,
    y: cy + ex * sa + ey * ca,
  };
}

function drawRadialBlob(ctx, cx, cy, rx, ry, rot, rgbInner, rgbOuter, alphaInner, alphaMid) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.12);
  g.addColorStop(0, rgba(rgbInner, alphaInner));
  g.addColorStop(0.45, rgba(muteWash(rgbInner, 0.06), alphaMid));
  g.addColorStop(0.78, rgba(rgbOuter, alphaMid * 0.45));
  g.addColorStop(1, rgba(rgbOuter, 0));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(Math.max(rx, 1), Math.max(ry, 1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNoisyRim(ctx, cx, cy, rx, ry, rot, rgbDark, seed, alpha = 0.38) {
  const segs = 48;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const brk = n(seed + i * 0.31);
    if (brk > 0.72 && i > 0 && i < segs) {
      ctx.stroke();
      ctx.beginPath();
    }
    const p = ellipsePoint(cx, cy, rx, ry, rot, t, seed + 8, 0.22);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = rgba(rgbDark, alpha);
  ctx.lineWidth = 0.85;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawBloom(ctx, cx, cy, rCore, rHalo, rgbCore, rgbHalo, alpha) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rHalo);
  g.addColorStop(0, rgba(shade(rgbCore, 0.55, -18), alpha * 0.95));
  g.addColorStop(0.18, rgba(rgbCore, alpha * 0.55));
  g.addColorStop(0.55, rgba(rgbHalo, alpha * 0.22));
  g.addColorStop(1, rgba(rgbHalo, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rHalo, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Multi-pass noisy closed paths — simulates how watercolor pigment pools unevenly.
 * Each pass is slightly offset and differently shaped, building transparency through layering.
 */
function drawWatercolorBlob(ctx, cx, cy, rx, ry, rot, rgb, baseAlpha, seed) {
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const passes = 14;
  for (let p = 0; p < passes; p++) {
    const ps = seed + p * 7.3;
    // Each pass drifts slightly — simulates pigment diffusion
    const ox = (n(ps + 1) - 0.5) * rx * 0.22;
    const oy = (n(ps + 2) - 0.5) * ry * 0.22;
    const passAlpha = baseAlpha * (0.4 + n(ps + 3) * 0.7) / passes;

    ctx.beginPath();
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      // fbm-driven radius variation — no two passes have the same boundary
      const noiseMul = 0.72 + fbm2(
        Math.cos(t) * 1.9 + ps * 0.08,
        Math.sin(t) * 1.9 + ps * 0.05,
        ps + 11,
        3,
      ) * 0.58;
      const ex = rx * noiseMul * Math.cos(t);
      const ey = ry * noiseMul * Math.sin(t);
      const x = cx + ox + ex * ca - ey * sa;
      const y = cy + oy + ex * sa + ey * ca;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(rgb, passAlpha);
    ctx.fill();
  }
}

/**
 * Edge darkening — watercolor dries darker at its boundary.
 * Draws several noisy strokes along the perimeter at low alpha.
 */
function drawEdgeDarken(ctx, cx, cy, rx, ry, rot, rgbDark, seed) {
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  for (let p = 0; p < 5; p++) {
    const ps = seed + p * 11.1 + 500;
    ctx.beginPath();
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const jitter = (n(ps + i * 0.4) - 0.5) * rx * 0.06;
      const noiseMul = 0.88 + fbm2(Math.cos(t) * 2.1 + ps, Math.sin(t) * 2.1, ps + 7, 2) * 0.2;
      const ex = (rx * noiseMul + jitter) * Math.cos(t);
      const ey = (ry * noiseMul + jitter) * Math.sin(t);
      const x = cx + ex * ca - ey * sa;
      const y = cy + ex * sa + ey * ca;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgba(rgbDark, 0.065 + n(ps + 100) * 0.055);
    ctx.lineWidth = 1.4 + n(ps + 101) * 3.2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/**
 * Pigment blooms — small dark pockets that form where wet pigment pools.
 * Biased toward the center of the shape, varied in size.
 */
function drawPigmentBlooms(ctx, cx, cy, rx, ry, rot, rgbDark, seed) {
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const count = 7 + Math.floor(n(seed + 300) * 9);
  for (let i = 0; i < count; i++) {
    const s = seed + i * 4.7 + 300;
    // sqrt bias places most blooms inside, fewer at edge
    const r = Math.sqrt(n(s + 1)) * 0.72;
    const a = n(s + 2) * Math.PI * 2;
    const ex = rx * r * Math.cos(a);
    const ey = ry * r * Math.sin(a);
    const bx = cx + ex * ca - ey * sa;
    const by = cy + ex * sa + ey * ca;
    const br = 1.2 + n(s + 3) * Math.max(rx, ry) * 0.055;
    ctx.fillStyle = rgba(rgbDark, 0.04 + n(s + 4) * 0.07);
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw ink wash for one game's pick.
 * midY  — absolute Y center of this game within the full canvas (canvas px, DPR-scaled).
 * rowH  — height of a single game row in canvas px; controls vertical blob sizing.
 *         Blobs are deliberately oversized to bleed beyond the row boundary.
 */
function drawInkWashField(ctx, W, H, seed, paletteRgb, sideSign, midY, strength, rowH = H) {
  const [c0, c1, c2] = paletteRgb;
  const m0 = muteWash(c0, 0.12);
  const m1 = muteWash(c1, 0.1);
  const m2 = muteWash(c2, 0.08);
  const cool = shade(m0, 1, sideSign * 3);
  const warm = shade(m1, 1.02, sideSign * -2);
  const deep = shade(c2, 0.42, -18);

  const cxBase = W * 0.5 + sideSign * W * 0.06;
  const blobs = 4;
  for (let b = 0; b < blobs; b++) {
    const bs = seed + b * 19.3;
    const cx = cxBase + sideSign * W * (0.08 + n(bs) * 0.28);
    // blobs intentionally drift beyond their row — bleed is the point
    const cy = midY + (n(bs + 1) - 0.5) * rowH * 0.9;
    const rx = W * (0.14 + n(bs + 2) * 0.2) * strength;
    // 1.5× height multiplier lets blobs spill into neighboring rows
    const ry = rowH * (0.28 + n(bs + 3) * 0.32) * strength * 1.5;
    const rot = (n(bs + 4) - 0.5) * 1.1;
    const bases = [cool, warm, shade(m2, 1.02, sideSign * 2)];
    const inner = bases[b % 3];
    const outer = muteWash(inner, 0.16);

    // Blurred base wash — the wet, soft underlayer
    ctx.save();
    ctx.filter = 'blur(10px)';
    ctx.globalCompositeOperation = 'multiply';
    drawRadialBlob(ctx, cx, cy, rx * 1.15, ry * 1.15, rot, muteWash(inner, 0.18), outer, 0.09 + n(bs + 5) * 0.05, 0.05);
    ctx.restore();

    // Multi-pass watercolor body — imperfect boundary, pooled pigment
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    drawWatercolorBlob(ctx, cx, cy, rx, ry, rot, inner, 0.58 + n(bs + 5) * 0.22, bs + 50);
    ctx.restore();

    // Soft-light glaze on top — depth without opacity
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    drawWatercolorBlob(
      ctx,
      cx + sideSign * W * 0.018,
      cy + (n(bs + 7) - 0.5) * 6,
      rx * 0.82,
      ry * 0.86,
      rot + 0.18,
      shade(inner, 1.06, 10),
      0.28 + n(bs + 8) * 0.14,
      bs + 80,
    );
    ctx.restore();

    // Edge darkening — the drying tide line
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    drawEdgeDarken(ctx, cx, cy, rx, ry, rot, deep, bs + 60);
    ctx.restore();

    // Pigment blooms — pooled darker pockets inside the wet area
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    drawPigmentBlooms(ctx, cx, cy, rx, ry, rot, deep, bs + 70);
    ctx.restore();
  }

  const numBlooms = 5 + Math.floor(n(seed + 60) * 4);
  for (let i = 0; i < numBlooms; i++) {
    const s = seed + i * 11.7;
    const bx = cxBase + sideSign * W * (0.05 + n(s) * 0.38);
    const by = midY + (n(s + 1) - 0.5) * rowH * 0.85;
    if (n(s + 2) > 0.35) {
      drawBloom(ctx, bx, by, 2 + n(s + 3) * 5, 14 + n(s + 4) * 22, deep, m1, 0.35 + n(s + 5) * 0.25);
    }
  }

  const strokes = 3 + Math.floor(n(seed + 80) * 3);
  for (let s = 0; s < strokes; s++) {
    const st = seed + s * 7.2;
    const len = W * (0.12 + n(st) * 0.22);
    const thick = 3 + n(st + 1) * 10;
    const ox = cxBase + sideSign * W * (0.1 + n(st + 2) * 0.35);
    const oy = midY + (n(st + 3) - 0.5) * rowH * 0.65;
    const angle = sideSign * (0.35 + (n(st + 4) - 0.5) * 0.5);
    const strokeRgb = s % 2 === 0 ? shade(m2, 0.82, -10) : shade(m0, 0.78, -8);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.12 + n(st + 5) * 0.1;
    ctx.strokeStyle = rgba(strokeRgb, 1);
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let px = ox;
    let py = oy;
    ctx.moveTo(px, py);
    const segs = 10;
    for (let k = 1; k <= segs; k++) {
      const t = k / segs;
      const wob = (fbm2(t * 4 + st, st * 0.3, st, 2) - 0.5) * 14;
      px = ox + Math.cos(angle) * len * t + sideSign * wob * 0.3;
      py = oy + Math.sin(angle) * len * t * 0.35 + wob;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Single continuous wobbly line through the entire field height — stitches all games together. */
function drawWobblyAxis(ctx, W, H, cx, seed, alphaMul) {
  const segs = 14;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const ty = i / segs;
    const y = 4 + ty * (H - 8);
    const w =
      (fbm2(ty * 3.5 + seed * 0.01, seed * 0.02, seed + 200, 3) - 0.5) *
      5 *
      (0.4 + ty * 0.6);
    const x = cx + w;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = `rgba(26,23,20,${0.09 * alphaMul})`;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawVsMark(ctx, cx, midY, seed, pick) {
  const hx = (fbm2(seed * 0.1, 1.2, seed + 50, 2) - 0.5) * 6;
  const hy = midY + (fbm2(2.1, seed * 0.08, seed + 51, 2) - 0.5) * 8;
  ctx.strokeStyle = pick ? 'rgba(26,23,20,0.07)' : 'rgba(26,23,20,0.11)';
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  const span = 14;
  ctx.moveTo(cx - span + hx * 0.5, hy);
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const wx = (n(seed + 60 + i) - 0.5) * 3;
    const wy = (n(seed + 70 + i) - 0.5) * 2;
    ctx.lineTo(cx - span + span * 2 * t + hx * 0.5 + wx * t, hy + wy * t);
  }
  ctx.stroke();
  ctx.fillStyle = pick ? 'rgba(26,23,20,0.14)' : 'rgba(26,23,20,0.22)';
  ctx.beginPath();
  ctx.arc(cx + hx * 0.4, hy, pick ? 1 : 1.1, 0, Math.PI * 2);
  ctx.fill();
}

/** Subtle full-field wash — blurred so it reads as atmosphere, not shape. */
function drawBackgroundWash(ctx, W, H, seed) {
  const muted = { r: 210, g: 204, b: 196 };
  for (let i = 0; i < 3; i++) {
    const s = seed + i * 23.7 + 900;
    const cx = W * (0.25 + n(s + 2) * 0.5);
    const cy = H * (0.15 + n(s + 3) * 0.7);
    const rx = W * (0.4 + n(s + 4) * 0.4);
    const ry = H * (0.25 + n(s + 5) * 0.35);
    const rot = (n(s + 6) - 0.5) * 0.8;
    ctx.save();
    ctx.filter = 'blur(22px)';
    ctx.globalCompositeOperation = 'multiply';
    drawRadialBlob(ctx, cx, cy, rx, ry, rot, muted, muted, 0.08 + n(s + 1) * 0.04, 0.05);
    ctx.restore();
  }
}

/**
 * Draws ALL matchups into one shared canvas — a single continuous artwork.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object[]} games
 * @param {Record<string, 'left'|'right'>} picks
 * @param {Array<{midY: number, height: number}>} layout — canvas px (DPR-scaled) per game
 */
export function drawField(canvas, games, picks, layout, seedOffset = 0) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  ctx.clearRect(0, 0, W, H);

  const offset = Number(seedOffset) || 0;
  const globalSeed =
    games.reduce(
      (acc, g) => acc + String(g.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0),
      0,
    ) + 7 + offset;

  drawPaperGrain(ctx, W, H, globalSeed);
  drawBackgroundWash(ctx, W, H, globalSeed);

  // Each picked game contributes its wash — blobs spill across boundaries intentionally
  games.forEach((game, i) => {
    const pick = picks[game.id];
    if (pick !== 'left' && pick !== 'right') return;
    const band = layout[i];
    if (!band) return;
    const seed = String(game.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 17 + offset;
    const paletteHex = artPaletteForPick(game, pick);
    const paletteRgb = paletteHex.map(parseHexColor);
    const sideSign = pick === 'left' ? -1 : 1;
    drawInkWashField(ctx, W, H, seed, paletteRgb, sideSign, band.midY, 1, band.height);
  });

  // One axis through the full field — the spine of the composition
  const cx = W * 0.5;
  const hasPicks = games.some(g => picks[g.id] === 'left' || picks[g.id] === 'right');
  drawWobblyAxis(ctx, W, H, cx, globalSeed, hasPicks ? 0.85 : 1);

  games.forEach((game, i) => {
    const band = layout[i];
    if (!band) return;
    const seed = String(game.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 17 + offset;
    const pick = picks[game.id];
    drawVsMark(ctx, cx, band.midY, seed, pick);
  });

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Phased ink bloom animation on the shared field canvas.
 * The animation is centered on midYOverride (absolute canvas Y), sized by rowHOverride,
 * and flows naturally beyond the row boundary — no clipping.
 *
 * Returns a cancel function; call it before starting a new animation on the same canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {'left'|'right'} direction
 * @param {string[]} palette — three hex colors [primary, secondary, accent]
 * @param {number} seed
 * @param {function} [onDone]
 * @param {number} [midYOverride] — absolute Y center in DPR-scaled canvas px
 * @param {number} [rowHOverride] — row height in DPR-scaled canvas px
 * @returns {() => void} cancel
 */
export function animateBrushStroke(canvas, direction, palette, seed, onDone, midYOverride, rowHOverride) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) {
    if (onDone) onDone();
    return () => {};
  }

  const hexes =
    Array.isArray(palette) && palette.length >= 3
      ? palette
      : [String(palette), String(palette), String(palette)];
  const p0 = parseHexColor(hexes[0]);
  const p1 = parseHexColor(hexes[1]);
  const p2 = parseHexColor(hexes[2]);
  const sideSign = direction === 'left' ? -1 : 1;
  const midY = midYOverride !== undefined ? midYOverride : H * 0.54;
  const rowH = rowHOverride !== undefined ? rowHOverride : H;
  const cx0 = W * 0.5;
  const totalSteps = 78;
  let step = 0;
  let cancelled = false;

  function drawStep() {
    if (cancelled) return;
    ctx.clearRect(0, 0, W, H);
    const u = step / totalSteps;
    const uEase = easeOutCubic(Math.min(1, u * 1.05));

    const pulse = smoothstep(0, 0.12, u) * (1 - smoothstep(0.1, 0.22, u));
    if (pulse > 0.01) {
      const g = ctx.createRadialGradient(cx0, midY, 0, cx0, midY, W * 0.12);
      g.addColorStop(0, rgba(shade(p0, 0.5, -30), 0.12 * pulse));
      g.addColorStop(1, rgba(p0, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    const growA = smoothstep(0.04, 0.42, uEase);
    const growB = smoothstep(0.12, 0.58, easeInOutQuad(u));
    const growC = smoothstep(0.18, 0.72, uEase);
    const haloT = smoothstep(0.1, 0.95, uEase) * (0.75 + n(seed + 1) * 0.2);

    const shiftX = sideSign * W * 0.04 * uEase;
    const cx = cx0 + shiftX;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';

    const mA = muteWash(p0, 0.16);
    const mB = muteWash(p1, 0.14);
    const mC = muteWash(p2, 0.12);
    const mBhot = shade(mB, 1.08, sideSign * 5);
    const mDeep = shade(mC, 0.95, -6);

    drawRadialBlob(
      ctx,
      cx + sideSign * W * 0.03 * growA,
      midY + (n(seed + 2) - 0.5) * 6 * (1 - uEase),
      W * (0.08 + growA * 0.32),
      rowH * (0.22 + growA * 0.42),
      (n(seed + 3) - 0.5) * 0.5,
      mBhot, muteWash(mBhot, 0.1),
      0.18 * growA, 0.1 * growA,
    );
    drawRadialBlob(
      ctx,
      cx + sideSign * W * 0.06 * growB,
      midY + (fbm2(u * 3, seed, seed + 4, 2) - 0.5) * rowH * 0.12,
      W * (0.06 + growB * 0.28),
      rowH * (0.18 + growB * 0.38),
      (n(seed + 5) - 0.5) * 0.65,
      mA, muteWash(mA, 0.1),
      0.14 * growB, 0.075 * growB,
    );
    drawRadialBlob(
      ctx,
      cx + sideSign * W * 0.1 * growC,
      midY,
      W * (0.05 + growC * 0.24),
      rowH * (0.15 + growC * 0.35),
      (n(seed + 6) - 0.5) * 0.4,
      mDeep, muteWash(mDeep, 0.12),
      0.11 * growC, 0.055 * growC,
    );
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const hx = W * (0.2 + haloT * 0.38);
    const hy = rowH * (0.32 + haloT * 0.35);
    ctx.translate(cx, midY);
    ctx.rotate(sideSign * 0.25 * uEase);
    const gH = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gH.addColorStop(0, rgba(muteWash(p1, 0.18), 0.14 * haloT));
    gH.addColorStop(0.55, rgba(muteWash(p2, 0.12), 0.08 * haloT));
    gH.addColorStop(1, rgba(p0, 0));
    ctx.fillStyle = gH;
    ctx.scale(hx, hy);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const rimGrow = smoothstep(0.08, 0.55, uEase);
    if (rimGrow > 0.05) {
      const rx = W * (0.1 + rimGrow * 0.34);
      const ry = rowH * (0.2 + rimGrow * 0.4);
      const rimCx = cx + sideSign * W * 0.04 * rimGrow;
      const rimRot = (n(seed) - 0.5) * 0.35;
      drawNoisyRim(ctx, rimCx, midY, rx, ry, rimRot, shade(p2, 0.35, -35), seed + 300, 0.28 * rimGrow);
      // Edge darkening grows in with the rim — the drying tide line
      if (rimGrow > 0.4) {
        const edgeAlpha = smoothstep(0.4, 0.9, rimGrow);
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = edgeAlpha * 0.7;
        drawEdgeDarken(ctx, rimCx, midY, rx * 0.92, ry * 0.92, rimRot, shade(p2, 0.32, -30), seed + 350);
        ctx.restore();
      }
    }

    // Pigment blooms appear inside the growing body
    if (u > 0.38) {
      const bt = smoothstep(0.38, 0.78, uEase);
      const bRx = W * (0.08 + bt * 0.22);
      const bRy = rowH * (0.15 + bt * 0.28);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = bt * 0.8;
      drawPigmentBlooms(ctx, cx, midY, bRx, bRy, (n(seed) - 0.5) * 0.4, shade(p2, 0.38, -25), seed + 410);
      ctx.restore();
    }

    if (u > 0.2) {
      const bt = smoothstep(0.2, 0.75, u);
      const num = 6;
      for (let i = 0; i < num; i++) {
        const s = seed + i * 13.1;
        const stagger = n(s + 1);
        if (uEase < stagger * 0.4) continue;
        const bx = cx0 + sideSign * W * (0.08 + n(s + 2) * 0.36 * bt);
        const by = midY + (n(s + 3) - 0.5) * rowH * 0.7;
        const br = (uEase - stagger * 0.25) * (18 + n(s + 4) * 16);
        if (br > 2) {
          drawBloom(ctx, bx, by, 3, br, shade(p2, 0.4, -22), muteWash(p1, 0.12), 0.32 * (1 - u * 0.35));
        }
      }
    }

    if (u > 0.45) {
      const sp = (u - 0.45) / 0.55;
      for (let i = 0; i < 10; i++) {
        const s = seed + i * 1.7 + 400;
        if (n(s) > 0.62) continue;
        const px = cx0 + sideSign * W * (0.05 + n(s + 1) * 0.42) + (n(s + 2) - 0.5) * 20;
        const py = midY + (n(s + 3) - 0.5) * rowH * 0.75;
        const pr = 0.8 + n(s + 4) * 2.8;
        const spl = [p0, p1, p2][i % 3];
        ctx.fillStyle = rgba(shade(spl, 0.55, -20), 0.22 * sp * n(s + 5));
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (u > 0.52) {
      const gt = (u - 0.52) / 0.48;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const gold = { r: 212, g: 175, b: 88 };
      const dashes = 5 + Math.floor(n(seed + 500) * 4);
      for (let d = 0; d < dashes; d++) {
        const ds = seed + d * 8.3;
        const delay = n(ds + 1) * 0.35;
        if (gt < delay) continue;
        const local = (gt - delay) / (1 - delay + 0.001);
        const x1 = cx0 + sideSign * W * (0.12 + n(ds + 2) * 0.32);
        const y1 = midY + (n(ds + 3) - 0.5) * rowH * 0.5;
        const len = 12 + n(ds + 4) * 28;
        const ang = sideSign * (0.2 + (n(ds + 5) - 0.5) * 0.6);
        let ax = x1;
        let ay = y1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        for (let p = 1; p <= 7; p++) {
          const t = (p / 7) * local;
          const j = (fbm2(d + t * 5, ds, ds + 7, 2) - 0.5) * 6;
          ax = x1 + Math.cos(ang) * len * t + j;
          ay = y1 + Math.sin(ang) * len * t * 0.4 + j;
          ctx.lineTo(ax, ay);
        }
        ctx.strokeStyle = rgba(gold, 0.14 * local * (0.5 + n(ds + 6) * 0.5));
        ctx.lineWidth = 0.6 + n(ds + 7) * 1.2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    if (u > 0.62) {
      const crossAlpha = smoothstep(0.62, 0.92, u);
      const endX = direction === 'left' ? W * 0.1 : W * 0.9;
      const markCy = midY + (n(seed + 90) - 0.5) * 12;
      ctx.strokeStyle = `rgba(26,23,20,${0.45 * crossAlpha})`;
      ctx.lineWidth = 0.55;
      ctx.globalAlpha = crossAlpha;
      ctx.beginPath();
      let x0 = endX + (direction === 'left' ? 8 : -8);
      let y0 = markCy - 10;
      ctx.moveTo(x0, y0);
      for (let k = 1; k <= 6; k++) {
        const t = k / 6;
        x0 = endX + (direction === 'left' ? 1 : -1) * t * 22 + (n(seed + 91 + k) - 0.5) * 4;
        y0 = markCy - 10 + t * 24 + (n(seed + 100 + k) - 0.5) * 3;
        ctx.lineTo(x0, y0);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(endX + (direction === 'left' ? 14 : -14), markCy + 4, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(26,23,20,${0.55 * crossAlpha})`;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'source-over';

    step++;
    if (step <= totalSteps) {
      requestAnimationFrame(drawStep);
    } else if (onDone) {
      onDone();
    }
  }

  drawStep();
  return () => { cancelled = true; };
}

/**
 * Capture a sequence of frames off a canvas.
 *
 * `drawFrame` is invoked with `(ctx, frameIndex, totalFrames, t)` where t is
 * a 0..1 progress value. The function may draw synchronously or return a
 * Promise; either is awaited before grabbing the next frame.
 *
 * Resolves with an array of `Blob` PNGs, ready to be muxed by ffmpeg.wasm
 * (see src/video/ffmpeg.js). Pure helper — no ffmpeg dependency here so the
 * function works in tests and offline.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {(ctx, i, n, t) => void | Promise<void>} drawFrame
 * @param {{ frames?: number, fps?: number, mimeType?: string, quality?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ blobs: Blob[], width: number, height: number, fps: number }>}
 */
export async function captureCanvasFrames(canvas, drawFrame, opts = {}) {
  if (!canvas || typeof drawFrame !== 'function') {
    throw new Error('captureCanvasFrames: canvas and drawFrame are required');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('captureCanvasFrames: 2D context unavailable');

  const fps = Math.max(1, Math.min(60, Number(opts.fps) || 30));
  const frames = Math.max(1, Math.min(900, Number(opts.frames) || fps * 4));
  const mimeType = opts.mimeType || 'image/png';
  const quality = typeof opts.quality === 'number' ? opts.quality : 0.92;
  const blobs = [];

  function snapshot() {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
          mimeType,
          quality,
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  for (let i = 0; i < frames; i++) {
    if (opts.signal?.aborted) {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }
    const t = frames === 1 ? 0 : i / (frames - 1);
    await drawFrame(ctx, i, frames, t);
    const blob = await snapshot();
    blobs.push(blob);
  }

  return { blobs, width: canvas.width, height: canvas.height, fps };
}
