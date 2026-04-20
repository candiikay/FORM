/**
 * Network shape — nodes joined by ink hairlines.
 *
 * Use for: coaching trees, athlete \u2192 sponsor relationships, ownership
 * networks, draft \u2192 franchise lines.
 *
 * Dataset shape:
 *   {
 *     nodes: [{ id, label, group?: string, weight?: number, color?: string }],
 *     edges: [{ from: nodeId, to: nodeId, weight?: number, color?: string }]
 *   }
 *
 * Layout uses a deterministic circular arrangement, grouped by `group` so
 * the eye reads the same diagram every render.
 */

import {
  INK, INK_MUTED, INK_FAINT,
  paintBackground,
  drawHeader, drawFooter, drawCaption,
  hashString, mulberry32,
} from './_primitives.js';

function parseHex(hex, fallback = '#1a1714') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || fallback).trim());
  if (!m) return fallback;
  return '#' + m[1].toLowerCase();
}

export function renderNetwork(canvas, dataset, style = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const nodes = Array.isArray(dataset.nodes) ? dataset.nodes : [];
  const edges = Array.isArray(dataset.edges) ? dataset.edges : [];

  const seedBase = hashString(nodes.map((n) => n.id).join(',') || 'empty');
  paintBackground(ctx, W, H, seedBase + 89);
  drawHeader(ctx, W, style);

  if (nodes.length === 0) {
    drawCaption(ctx, W, Math.round(H * 0.5), 'No nodes provided.');
    drawFooter(ctx, W, H, style);
    return;
  }

  const headerH = Math.round(H * 0.22);
  const footerH = Math.round(H * 0.12);
  const cx = W / 2;
  const cy = headerH + (H - headerH - footerH) / 2;
  const r  = Math.min(W, H - headerH - footerH) * 0.36;

  // Group + sort for stable layout
  const grouped = nodes.slice().sort((a, b) => {
    const ga = String(a.group || ''); const gb = String(b.group || '');
    if (ga !== gb) return ga.localeCompare(gb);
    return String(a.id).localeCompare(String(b.id));
  });

  const positions = {};
  grouped.forEach((n, i) => {
    const t = i / grouped.length;
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    positions[n.id] = {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      angle,
      node: n,
    };
  });

  // Edges first
  const rand = mulberry32(seedBase + 137);
  edges.forEach((e) => {
    const a = positions[e.from];
    const b = positions[e.to];
    if (!a || !b) return;
    const w = Math.max(0.6, (Number(e.weight) || 1) * 0.7);
    const alpha = 0.22 + rand() * 0.18;
    const color = e.color || '#1a1714';
    ctx.strokeStyle = (() => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(color).replace('#', ''));
      if (!m) return `rgba(26,23,20,${alpha})`;
      const v = parseInt(m[1], 16);
      const r2 = (v >> 16) & 255, g2 = (v >> 8) & 255, b2 = v & 255;
      return `rgba(${r2},${g2},${b2},${alpha})`;
    })();
    ctx.lineWidth = w;
    ctx.lineCap = 'round';

    // Curve through center for legibility
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const tx = mx + (cx - mx) * 0.35;
    const ty = my + (cy - my) * 0.35;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(tx, ty, b.x, b.y);
    ctx.stroke();
  });

  // Nodes
  Object.values(positions).forEach((p) => {
    const radius = Math.max(3.5, (Number(p.node.weight) || 1) * 4);
    const color = parseHex(p.node.color, '#1a1714');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Label, anchored outward
    const labelDist = radius + 10;
    const lx = p.x + Math.cos(p.angle) * labelDist;
    const ly = p.y + Math.sin(p.angle) * labelDist;
    const align = Math.cos(p.angle) >= 0 ? 'left' : 'right';

    ctx.font = `400 ${Math.round(W * 0.018)}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = INK_MUTED;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.16em';
    if (p.node.kicker) {
      ctx.fillText(String(p.node.kicker).toUpperCase(), lx, ly - Math.round(W * 0.015));
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    ctx.font = `italic 400 ${Math.round(W * 0.022)}px "EB Garamond", Georgia, serif`;
    ctx.fillStyle = INK;
    ctx.fillText(String(p.node.label || p.node.id), lx, ly + Math.round(W * 0.005));
  });

  if (style.caption) drawCaption(ctx, W, cy + r + Math.round(H * 0.06), style.caption);
  drawFooter(ctx, W, H, style);

  void INK_FAINT;
}
