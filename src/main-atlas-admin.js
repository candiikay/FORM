/** Atlas Admin — curate Featured Plates locally and export them as JSON.
 *
 * Drafts are saved to a separate localStorage bucket (`atlas_admin_drafts_v1`)
 * so they don't pollute a regular user's "Your Plates" shelf. Each draft can
 * be previewed at full size, copied as JSON for inclusion in
 * `src/atlas/featured.js`, or deleted.
 */

import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

import { FEATURED_PLATES, getFeaturedPlate } from './atlas/featured.js';
import { renderPlate } from './atlas/render.js';
import {
  openComposer,
  deleteYourPlate,
  loadYourPlates,
} from './atlas/compose.js';

const LS_DRAFTS = 'atlas_admin_drafts_v1';

function showToast(text, ms = 2400) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('toast--visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('toast--visible'), ms);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plateCardMarkup(plate, idx, kind) {
  const removable = kind === 'draft';
  return `
    <div class="atlas-plate-wrap" data-plate-kind="${kind}">
      <button
        type="button"
        class="atlas-plate"
        data-plate-id="${escapeHtml(plate.id)}"
        data-plate-kind="${kind}"
        aria-label="Open plate: ${escapeHtml(plate.title || plate.id)}"
      >
        <div class="atlas-plate__canvas-wrap">
          <canvas class="atlas-plate__canvas" id="atlas-admin-canvas-${kind}-${idx}"></canvas>
        </div>
        <div class="atlas-plate__meta">
          <p class="atlas-plate__kicker">${escapeHtml((plate.kicker || plate.pillar || '').toUpperCase())}</p>
          <p class="atlas-plate__title">${escapeHtml(plate.title || plate.id)}</p>
          ${plate.subtitle ? `<p class="atlas-plate__subtitle">${escapeHtml(plate.subtitle)}</p>` : ''}
        </div>
      </button>
      ${removable ? `
        <button
          type="button"
          class="atlas-plate__delete"
          data-delete-id="${escapeHtml(plate.id)}"
          title="Delete draft"
        >Remove</button>
      ` : ''}
    </div>
  `;
}

function renderPublishedRail() {
  const rail = document.getElementById('published-rail');
  if (!rail) return;
  rail.innerHTML = FEATURED_PLATES
    .map((plate, i) => plateCardMarkup(plate, i, 'published'))
    .join('');
  FEATURED_PLATES.forEach((plate, i) => {
    const canvas = document.getElementById(`atlas-admin-canvas-published-${i}`);
    if (!canvas) return;
    requestAnimationFrame(() => renderPlate(canvas, plate, { aspect: 1.25 }));
  });
  rail.querySelectorAll('.atlas-plate').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-plate-id');
      openPlateDialog(getFeaturedPlate(id), 'published');
    });
  });
}

function renderDraftShelf() {
  const host = document.getElementById('draft-shelf');
  if (!host) return;
  const drafts = loadYourPlates(LS_DRAFTS);
  if (drafts.length === 0) {
    host.innerHTML = `
      <div class="atlas-shelf-empty">
        <p class="atlas-shelf-empty__line">No drafts yet.</p>
        <p class="atlas-shelf-empty__sub">Composed plates will live here until you export them.</p>
      </div>
    `;
    return;
  }
  host.innerHTML = drafts
    .map((plate, i) => plateCardMarkup(plate, i, 'draft'))
    .join('');
  drafts.forEach((plate, i) => {
    const canvas = document.getElementById(`atlas-admin-canvas-draft-${i}`);
    if (!canvas) return;
    requestAnimationFrame(() => renderPlate(canvas, plate, { aspect: 1.25 }));
  });

  host.querySelectorAll('.atlas-plate').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-plate-id');
      const plate = drafts.find((p) => p.id === id);
      if (plate) openPlateDialog(plate, 'draft');
    });
  });

  host.querySelectorAll('[data-delete-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-delete-id');
      if (!id) return;
      if (!confirm('Delete this draft?')) return;
      deleteYourPlate(id, LS_DRAFTS);
      renderDraftShelf();
      showToast('draft removed');
    });
  });
}

function plateAsExportObject(plate) {
  const allowed = [
    'id', 'title', 'subtitle', 'kicker', 'pillar', 'shape',
    'citation', 'palette', 'domain', 'dateMode', 'density',
    'events', 'points', 'bands', 'sources', 'targets',
    'flows', 'nodes', 'edges', 'quotes', 'caption',
  ];
  const out = {};
  for (const k of allowed) {
    if (plate[k] !== undefined && plate[k] !== null && plate[k] !== '') out[k] = plate[k];
  }
  return out;
}

async function copyPlateJson(plate) {
  const obj = plateAsExportObject(plate);
  const text = JSON.stringify(obj, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    showToast('JSON copied — paste into featured.js');
  } catch (err) {
    console.warn('[admin] clipboard failed', err);
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('JSON copied'); }
    catch { showToast('Copy failed — see console'); console.log(text); }
    ta.remove();
  }
}

function openPlateDialog(plate, kind) {
  if (!plate) return;
  const dialog = document.getElementById('plate-dialog');
  const titleEl = document.getElementById('plate-dialog-title');
  const canvas = document.getElementById('plate-dialog-canvas');
  const actions = document.getElementById('plate-view-actions');
  if (!dialog || !canvas) return;
  if (titleEl) titleEl.textContent = plate.title || plate.id;
  if (actions) {
    actions.innerHTML = `
      <button type="button" class="preview__share" id="plate-copy-json">
        <span class="preview__share-text">Copy JSON</span>
        <span class="preview__share-kicker">${kind === 'draft' ? 'promote to featured' : 'inspect plate'}</span>
      </button>
    `;
    document.getElementById('plate-copy-json')?.addEventListener('click', () => copyPlateJson(plate));
  }
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  requestAnimationFrame(() => renderPlate(canvas, plate, { aspect: 1.25 }));
}

function wirePlateDialogClose() {
  const dialog = document.getElementById('plate-dialog');
  const close = document.getElementById('plate-dialog-close');
  close?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
}

function wireComposeCta() {
  const cta = document.getElementById('admin-compose-cta');
  if (!cta) return;
  cta.addEventListener('click', () => {
    openComposer({
      storageKey: LS_DRAFTS,
      onSaved: (plate) => {
        renderDraftShelf();
        showToast(`draft saved · ${plate.title || 'plate'}`);
      },
    });
  });
}

function init() {
  renderPublishedRail();
  renderDraftShelf();
  wirePlateDialogClose();
  wireComposeCta();
}

init();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderPublishedRail();
    renderDraftShelf();
  }, 180);
});
