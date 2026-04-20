/** Atlas page entry — mounts the share-card maker into #main-content. */

import { registerServiceWorker } from './pwa.js';
import { mountMaker } from './atlas/maker.js';

registerServiceWorker();

function showToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('toast--visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('toast--visible'), 2400);
}

const host = document.getElementById('main-content');
mountMaker(host, { onToast: showToast });
