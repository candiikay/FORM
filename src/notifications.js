/** Lightweight notification opt-in for FORM.
 *
 * Built on the browser Notification API only — no external push server.
 * When a Service Worker is registered (Phase 7), it can intercept and
 * display these via `registration.showNotification`, but the public API
 * here stays the same.
 *
 * Storage:
 *   form_notif_prefs_v1 → { enabled: boolean, channels: { lockIn, results, wallStir } }
 */

const LS_PREFS = 'form_notif_prefs_v1';

const DEFAULT_PREFS = Object.freeze({
  enabled: false,
  channels: {
    lockIn: true,
    results: true,
    wallStir: true,
  },
});

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(LS_PREFS);
    if (!raw) return { ...DEFAULT_PREFS, channels: { ...DEFAULT_PREFS.channels } };
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      channels: {
        ...DEFAULT_PREFS.channels,
        ...(parsed.channels || {}),
      },
    };
  } catch {
    return { ...DEFAULT_PREFS, channels: { ...DEFAULT_PREFS.channels } };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[notif] save failed', err);
  }
}

/** Toggle a single channel and persist. */
export function setChannel(name, on) {
  const prefs = loadPrefs();
  prefs.channels[name] = !!on;
  savePrefs(prefs);
  return prefs;
}

export function setEnabled(on) {
  const prefs = loadPrefs();
  prefs.enabled = !!on;
  savePrefs(prefs);
  return prefs;
}

/** Ask the browser; resolve to the new permission string. */
export async function requestPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch (err) {
    console.warn('[notif] request failed', err);
    return Notification.permission;
  }
}

function shouldFire(channel) {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const prefs = loadPrefs();
  if (!prefs.enabled) return false;
  if (channel && !prefs.channels[channel]) return false;
  return true;
}

async function showNative(title, options = {}) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration?.();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
    const n = new Notification(title, options);
    if (options.url && typeof window !== 'undefined') {
      n.onclick = () => {
        try { window.focus(); } catch { /* ignore */ }
        try { window.open(options.url, '_self'); } catch { /* ignore */ }
        n.close();
      };
    }
    return true;
  } catch (err) {
    console.warn('[notif] show failed', err);
    return false;
  }
}

export async function notifyLockedIn({ pointsEarned = 0, pending = 0, weekLabel = '' } = {}) {
  if (!shouldFire('lockIn')) return false;
  const title = pointsEarned > 0
    ? `+${pointsEarned} pts \u00b7 form locked`
    : pending > 0
      ? `Form locked \u00b7 ${pending} pending`
      : 'Form locked';
  return showNative(title, {
    body: weekLabel ? `Your form for ${weekLabel} is in.` : 'Your form is in.',
    tag: 'form-lockin',
    icon: '/favicon.ico',
    url: '/you.html',
  });
}

export async function notifyResults({ pointsEarned = 0, weekLabel = '' } = {}) {
  if (!shouldFire('results')) return false;
  const title = pointsEarned > 0
    ? `Results in \u00b7 +${pointsEarned} pts`
    : 'Results in';
  return showNative(title, {
    body: weekLabel
      ? `Your ${weekLabel} form has been scored.`
      : 'Your form has been scored.',
    tag: 'form-results',
    icon: '/favicon.ico',
    url: '/you.html',
  });
}

export async function notifyWallStir(text) {
  if (!shouldFire('wallStir')) return false;
  return showNative('The Wall stirred', {
    body: text || 'The room is moving.',
    tag: 'form-wall-stir',
    renotify: false,
    icon: '/favicon.ico',
    url: '/wall.html',
  });
}

/** Reset all preferences. Useful from the settings UI. */
export function resetPrefs() {
  try { localStorage.removeItem(LS_PREFS); } catch { /* ignore */ }
}
