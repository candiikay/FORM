/**
 * Persistent identity chip for the masthead.
 *
 * Guests see "Sign in" → opens the shared <dialog id="auth-dialog">.
 * Signed-in users see their first name (or initial) → routes to you.html.
 *
 * Usage:
 *   import { mountIdentityChip } from './identity-chip.js';
 *   mountIdentityChip();      // looks for [data-identity-chip] in the page
 */

import { getCurrentUser } from './auth.js';
import { openAuthDialog } from './auth-ui.js';

function shortLabel(user) {
  const name = String(user?.name || '').trim();
  if (name) {
    const first = name.split(/\s+/)[0];
    return first.length > 14 ? `${first.slice(0, 13)}…` : first;
  }
  return 'You';
}

function render(host) {
  const user = getCurrentUser();
  if (user) {
    host.innerHTML = `
      <a class="identity-chip identity-chip--known" href="you.html" aria-label="Your form">
        <span class="identity-chip__dot" aria-hidden="true"></span>
        <span class="identity-chip__label">${escapeHtml(shortLabel(user))}</span>
      </a>
    `;
  } else {
    host.innerHTML = `
      <button type="button" class="identity-chip identity-chip--guest" data-identity-signin>
        <span class="identity-chip__label">Sign in</span>
        <span class="identity-chip__mark" aria-hidden="true">↗</span>
      </button>
    `;
    const btn = host.querySelector('[data-identity-signin]');
    btn?.addEventListener('click', async () => {
      const result = await openAuthDialog();
      if (result) {
        render(host);
        host.dispatchEvent(
          new CustomEvent('identity:change', { bubbles: true, detail: { user: result } }),
        );
      }
    });
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mountIdentityChip() {
  const host = document.querySelector('[data-identity-chip]');
  if (!host) return null;
  render(host);
  window.addEventListener('pageshow', () => render(host));
  return {
    refresh() {
      render(host);
    },
  };
}
