import { fetchSchedule } from './api.js';
import { registerServiceWorker } from './pwa.js';

registerServiceWorker();
import { initSchedule, getPicks } from './state.js';
import {
  buildGameRows,
  wireSetAction,
  wireShareAction,
  wireViewForm,
  wirePreviewDialog,
  reflowRowArtwork,
  setWeekLabel,
  syncHeaderMeta,
} from './interaction.js';
import { mountIdentityChip } from './identity-chip.js';

function showSkeleton() {
  const container = document.getElementById('games-container');
  if (!container) return;
  for (let i = 0; i < 4; i++) {
    const wrap = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'game-row game-row--skeleton';
    wrap.appendChild(row);
    if (i < 3) {
      const div = document.createElement('div');
      div.className = 'divider';
      wrap.appendChild(div);
    }
    container.appendChild(wrap);
  }
}

function syncPickHint() {
  const hint = document.getElementById('pick-hint');
  if (!hint) return;
  const hasAny = Object.keys(getPicks()).length > 0;
  if (hasAny) {
    hint.hidden = true;
    return;
  }
  hint.hidden = false;
  hint.textContent = '← tap a side to pick · swipe →';
}

async function init() {
  mountIdentityChip();
  setWeekLabel();
  syncHeaderMeta();
  showSkeleton();

  const schedule = await fetchSchedule();
  initSchedule(schedule);
  buildGameRows();
  wireSetAction();
  wireShareAction();
  wireViewForm();
  wirePreviewDialog();
  syncPickHint();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => reflowRowArtwork(), 120);
  });
}

init();
