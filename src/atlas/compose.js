/**
 * Compose flow — Subject → Shape → Style → Render → Save.
 *
 * Renders a dialog into the document on demand. The flow is intentionally
 * three short steps so a maker can move from idea to finished plate without
 * ever feeling like they've opened a "configurator." Live preview at every step.
 *
 * Saves to localStorage under `form_your_plates_v1` (managed by main-atlas.js).
 */

import { SUBJECTS, getSubject } from './subjects.js';
import { renderPlate } from './render.js';
import { PALETTES } from './shapes/_primitives.js';

const LS_YOUR_PLATES = 'form_your_plates_v1';

const PALETTE_OPTIONS = Object.keys(PALETTES);

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uid() {
  return 'p_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

function loadYourPlates(key = LS_YOUR_PLATES) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveYourPlates(arr, key = LS_YOUR_PLATES) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (err) {
    console.warn('[compose] save failed', err);
  }
}

function ensureDialog() {
  let dialog = document.getElementById('compose-dialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'compose-dialog';
  dialog.className = 'compose-dialog';
  dialog.setAttribute('aria-labelledby', 'compose-dialog-title');
  dialog.innerHTML = `
    <article class="compose">
      <header class="compose__head">
        <p class="compose__kicker" id="compose-step-kicker">SUBJECT</p>
        <h2 class="compose__title" id="compose-dialog-title">Make a plate</h2>
        <button type="button" class="compose__close" id="compose-close" aria-label="Close">
          <span aria-hidden="true">\u00d7</span>
        </button>
      </header>
      <div class="compose__body" id="compose-body"></div>
      <div class="compose__preview" id="compose-preview" hidden>
        <p class="compose__preview-kicker">PREVIEW</p>
        <div class="compose__preview-canvas-wrap">
          <canvas id="compose-preview-canvas" class="compose__preview-canvas" aria-label="Live preview of your plate"></canvas>
        </div>
      </div>
      <footer class="compose__foot">
        <button type="button" class="compose__back" id="compose-back" hidden>\u2190 Back</button>
        <div class="compose__spacer"></div>
        <button type="button" class="compose__next" id="compose-next" disabled>Next \u2192</button>
        <button type="button" class="compose__save" id="compose-save" hidden>Save plate</button>
      </footer>
    </article>
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  return dialog;
}

const state = {
  step: 1,
  subjectId: null,
  shape: null,
  entityId: null,
  style: {},
  onSaved: null,
  storageKey: LS_YOUR_PLATES,
  resizeListener: null,
};

function reset(onSaved, storageKey = LS_YOUR_PLATES) {
  state.step = 1;
  state.subjectId = null;
  state.shape = null;
  state.entityId = null;
  state.style = {};
  state.onSaved = onSaved || null;
  state.storageKey = storageKey || LS_YOUR_PLATES;
}

async function buildPlateModel() {
  const subject = getSubject(state.subjectId);
  if (!subject) return null;
  const built = await subject.build({ entityId: state.entityId });
  const baseStyle = subject.defaultStyle || {};
  const style = { ...baseStyle, ...state.style };
  if (!style.title && built._label) style.title = built._label;
  if (!style.kicker) style.kicker = subject.kicker;
  return {
    id: uid(),
    shape: state.shape || subject.defaultShape,
    subjectId: subject.id,
    entityId: state.entityId || null,
    createdAt: new Date().toISOString(),
    ...style,
    events: built.events,
    points: built.points,
    bands: built.bands,
    domain: built.domain,
  };
}

async function repaintPreview() {
  const wrap = document.getElementById('compose-preview');
  const canvas = document.getElementById('compose-preview-canvas');
  if (!wrap || !canvas) return;
  if (state.step < 3) {
    wrap.hidden = true;
    return;
  }
  const plate = await buildPlateModel();
  if (!plate) return;
  wrap.hidden = false;
  requestAnimationFrame(() => renderPlate(canvas, plate, { aspect: 1.25 }));
}

function setKicker(text) {
  const k = document.getElementById('compose-step-kicker');
  if (k) k.textContent = text;
}

function setNextEnabled(on) {
  const b = document.getElementById('compose-next');
  if (b) b.disabled = !on;
}

function showSaveInsteadOfNext(show) {
  const next = document.getElementById('compose-next');
  const save = document.getElementById('compose-save');
  if (next) next.hidden = !!show;
  if (save) save.hidden = !show;
}

function showBack(on) {
  const b = document.getElementById('compose-back');
  if (b) b.hidden = !on;
}

async function renderStepSubject() {
  setKicker('STEP 1 / 3 \u00b7 SUBJECT');
  showBack(false);
  showSaveInsteadOfNext(false);
  setNextEnabled(!!state.subjectId);

  const body = document.getElementById('compose-body');
  if (!body) return;
  body.innerHTML = `
    <p class="compose__lede">Pick what you want this plate to be about.</p>
    <ul class="compose__subjects" role="listbox" aria-label="Subjects">
      ${SUBJECTS.map((s) => `
        <li>
          <button
            type="button"
            class="compose__subject ${state.subjectId === s.id ? 'is-selected' : ''}"
            data-subject="${escapeHtml(s.id)}"
            aria-pressed="${state.subjectId === s.id ? 'true' : 'false'}"
          >
            <span class="compose__subject-kicker">${escapeHtml((s.kicker || '').toUpperCase())}</span>
            <span class="compose__subject-title">${escapeHtml(s.title)}</span>
            <span class="compose__subject-desc">${escapeHtml(s.description || '')}</span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  body.querySelectorAll('[data-subject]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-subject');
      state.subjectId = id;
      const subject = getSubject(id);
      state.shape = subject?.defaultShape || subject?.compatibleShapes?.[0] || null;
      state.entityId = null;
      state.style = {};
      renderStepSubject();
    });
  });
}

async function renderStepShape() {
  setKicker('STEP 2 / 3 \u00b7 SHAPE');
  showBack(true);
  showSaveInsteadOfNext(false);

  const subject = getSubject(state.subjectId);
  if (!subject) {
    state.step = 1;
    return renderStepSubject();
  }

  const body = document.getElementById('compose-body');
  if (!body) return;

  let entityPickerHtml = '';
  if (subject.needs?.entityType && typeof subject.listOptions === 'function') {
    const opts = await subject.listOptions();
    entityPickerHtml = `
      <label class="compose__field">
        <span class="compose__field-label">${escapeHtml(subject.needs.entityType === 'team' ? 'Team' : 'Person')}</span>
        <select id="compose-entity" class="compose__select">
          <option value="">Choose one\u2026</option>
          ${opts.map((o) => `
            <option value="${escapeHtml(o.id)}" ${state.entityId === o.id ? 'selected' : ''}>${escapeHtml(o.label)}</option>
          `).join('')}
        </select>
      </label>
    `;
  }

  body.innerHTML = `
    <p class="compose__lede">How should ${escapeHtml(subject.title)} look on paper?</p>
    ${entityPickerHtml}
    <ul class="compose__shapes" role="listbox" aria-label="Shapes">
      ${subject.compatibleShapes.map((sh) => `
        <li>
          <button
            type="button"
            class="compose__shape ${state.shape === sh ? 'is-selected' : ''}"
            data-shape="${escapeHtml(sh)}"
            aria-pressed="${state.shape === sh ? 'true' : 'false'}"
          >
            <span class="compose__shape-name">${escapeHtml(sh.replace('-', ' '))}</span>
            <span class="compose__shape-desc">${escapeHtml(shapeDescription(sh))}</span>
          </button>
        </li>
      `).join('')}
    </ul>
  `;

  body.querySelectorAll('[data-shape]').forEach((el) => {
    el.addEventListener('click', () => {
      state.shape = el.getAttribute('data-shape');
      renderStepShape();
    });
  });

  const sel = document.getElementById('compose-entity');
  sel?.addEventListener('change', () => {
    state.entityId = sel.value || null;
    refreshShapeEnable();
  });

  refreshShapeEnable();

  function refreshShapeEnable() {
    const needsEntity = !!subject.needs?.entityType;
    const ok = !!state.shape && (!needsEntity || !!state.entityId);
    setNextEnabled(ok);
  }
}

function shapeDescription(shape) {
  switch (shape) {
    case 'timeline': return 'Annotated horizontal hairline.';
    case 'timeseries': return 'A single ink stroke through ordered points.';
    case 'palette-stack': return 'A vertical stack of pigment swatches.';
    default: return '';
  }
}

async function renderStepStyle() {
  setKicker('STEP 3 / 3 \u00b7 STYLE');
  showBack(true);
  showSaveInsteadOfNext(true);

  const subject = getSubject(state.subjectId);
  const baseStyle = subject?.defaultStyle || {};

  // If subject is entity-driven (team/person), seed title from entity name
  // the first time we land on Style so the input doesn't render empty.
  if (state.style.title === undefined) {
    const built = await subject?.build({ entityId: state.entityId });
    if (built?._label && !baseStyle.title) state.style.title = built._label;
  }

  const merged = { ...baseStyle, ...state.style };

  const body = document.getElementById('compose-body');
  if (!body) return;
  body.innerHTML = `
    <p class="compose__lede">A few words and a palette. Citation lives at the foot of every plate.</p>
    <label class="compose__field">
      <span class="compose__field-label">Title</span>
      <input
        id="compose-title"
        class="compose__input"
        type="text"
        value="${escapeHtml(merged.title || '')}"
        maxlength="64"
        placeholder="A short title"
      />
    </label>
    <label class="compose__field">
      <span class="compose__field-label">Subtitle</span>
      <input
        id="compose-subtitle"
        class="compose__input"
        type="text"
        value="${escapeHtml(merged.subtitle || '')}"
        maxlength="120"
        placeholder="A line that frames the data"
      />
    </label>
    <label class="compose__field">
      <span class="compose__field-label">Kicker</span>
      <input
        id="compose-kicker"
        class="compose__input"
        type="text"
        value="${escapeHtml(merged.kicker || subject?.kicker || '')}"
        maxlength="32"
      />
    </label>
    <fieldset class="compose__field">
      <legend class="compose__field-label">Palette</legend>
      <div class="compose__palettes" role="listbox" aria-label="Palette">
        ${PALETTE_OPTIONS.map((p) => `
          <button
            type="button"
            class="compose__palette ${(merged.palette || 'ink') === p ? 'is-selected' : ''}"
            data-palette="${escapeHtml(p)}"
            aria-pressed="${(merged.palette || 'ink') === p ? 'true' : 'false'}"
            title="${escapeHtml(p)}"
          >
            <span class="compose__palette-swatches">
              ${PALETTES[p].map((c) => `<i style="background:${c}"></i>`).join('')}
            </span>
            <span class="compose__palette-name">${escapeHtml(p)}</span>
          </button>
        `).join('')}
      </div>
    </fieldset>
    <label class="compose__field">
      <span class="compose__field-label">Citation</span>
      <input
        id="compose-citation"
        class="compose__input"
        type="text"
        value="${escapeHtml(merged.citation || '')}"
        maxlength="160"
        placeholder="Source: \u2026"
      />
    </label>
  `;

  function readForm() {
    state.style = {
      ...state.style,
      title: document.getElementById('compose-title')?.value || '',
      subtitle: document.getElementById('compose-subtitle')?.value || '',
      kicker: document.getElementById('compose-kicker')?.value || '',
      citation: document.getElementById('compose-citation')?.value || '',
    };
  }

  ['compose-title', 'compose-subtitle', 'compose-kicker', 'compose-citation'].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('input', () => {
      readForm();
      repaintPreview();
    });
  });

  body.querySelectorAll('[data-palette]').forEach((el) => {
    el.addEventListener('click', () => {
      state.style.palette = el.getAttribute('data-palette');
      renderStepStyle();
    });
  });

  await repaintPreview();
}

async function renderCurrentStep() {
  if (state.step === 1) await renderStepSubject();
  else if (state.step === 2) await renderStepShape();
  else if (state.step === 3) await renderStepStyle();
  await repaintPreview();
}

function wireFooter(dialog) {
  const back = document.getElementById('compose-back');
  const next = document.getElementById('compose-next');
  const save = document.getElementById('compose-save');
  const close = document.getElementById('compose-close');

  back?.addEventListener('click', async () => {
    state.step = Math.max(1, state.step - 1);
    await renderCurrentStep();
  });

  next?.addEventListener('click', async () => {
    if (state.step === 1 && !state.subjectId) return;
    if (state.step === 2 && !state.shape) return;
    state.step = Math.min(3, state.step + 1);
    await renderCurrentStep();
  });

  save?.addEventListener('click', async () => {
    const plate = await buildPlateModel();
    if (!plate) return;
    const list = loadYourPlates(state.storageKey);
    list.unshift(plate);
    saveYourPlates(list, state.storageKey);
    dialog.close();
    if (typeof state.onSaved === 'function') state.onSaved(plate);
  });

  close?.addEventListener('click', () => dialog.close());
}

function attachResize() {
  if (state.resizeListener) return;
  state.resizeListener = () => {
    clearTimeout(state.resizeListener._t);
    state.resizeListener._t = setTimeout(() => repaintPreview(), 180);
  };
  window.addEventListener('resize', state.resizeListener);
}

function detachResize() {
  if (!state.resizeListener) return;
  window.removeEventListener('resize', state.resizeListener);
  state.resizeListener = null;
}

export function openComposer({ onSaved, storageKey } = {}) {
  reset(onSaved, storageKey);
  const dialog = ensureDialog();

  const close = document.getElementById('compose-close');
  if (close && !close._wired) {
    close._wired = true;
    wireFooter(dialog);
  } else if (!close?._wired) {
    wireFooter(dialog);
  }

  attachResize();

  dialog.addEventListener(
    'close',
    () => {
      detachResize();
    },
    { once: true },
  );

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  renderCurrentStep();
}

export function deleteYourPlate(id, storageKey = LS_YOUR_PLATES) {
  const list = loadYourPlates(storageKey).filter((p) => p.id !== id);
  saveYourPlates(list, storageKey);
}

export { loadYourPlates };
