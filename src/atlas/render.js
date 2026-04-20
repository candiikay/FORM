/** Shape dispatcher — keeps page code from importing every shape directly. */

import { renderTimeline } from './shapes/timeline.js';
import { renderTimeseries } from './shapes/timeseries.js';
import { renderPaletteStack } from './shapes/palette-stack.js';
import { renderSankey } from './shapes/sankey.js';
import { renderNetwork } from './shapes/network.js';
import { renderEventRibbon } from './shapes/event-ribbon.js';
import { renderTreemap } from './shapes/treemap.js';
import { renderQuoteCard } from './shapes/quote-card.js';

const SHAPES = {
  timeline: renderTimeline,
  timeseries: renderTimeseries,
  'palette-stack': renderPaletteStack,
  sankey: renderSankey,
  network: renderNetwork,
  'event-ribbon': renderEventRibbon,
  treemap: renderTreemap,
  'quote-card': renderQuoteCard,
};

/**
 * Resize a canvas to a given CSS width with a target aspect, scale for DPR,
 * and dispatch the chosen shape's renderer.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} plate — { shape, events|points|bands, domain, ...style }
 * @param {{cssWidth?: number, aspect?: number}} [opts]
 */
export function renderPlate(canvas, plate, opts = {}) {
  if (!canvas || !plate) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth =
    opts.cssWidth ||
    canvas.parentElement?.offsetWidth ||
    canvas.clientWidth ||
    320;
  const aspect = opts.aspect || 1.25;
  const cssHeight = Math.round(cssWidth / aspect);
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  const renderer = SHAPES[plate.shape];
  if (!renderer) return;

  const drawCanvas = {
    width: cssWidth,
    height: cssHeight,
    getContext: () => ctx,
  };

  const dataset = {
    events: plate.events,
    domain: plate.domain,
    points: plate.points,
    bands: plate.bands,
    sources: plate.sources,
    targets: plate.targets,
    flows: plate.flows,
    nodes: plate.nodes,
    edges: plate.edges,
    quotes: plate.quotes,
  };

  const style = {
    kicker: plate.kicker,
    title: plate.title,
    subtitle: plate.subtitle,
    citation: plate.citation,
    dateMode: plate.dateMode,
    density: plate.density,
    palette: plate.palette,
    caption: plate.caption,
    endLabel: plate.endLabel,
    useLabelsOnAxis: plate.useLabelsOnAxis,
  };

  renderer(drawCanvas, dataset, style);
}

export function listAvailableShapes() {
  return Object.keys(SHAPES);
}
