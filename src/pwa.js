/** Tiny PWA bootstrap — registers the service worker if supported.
 *
 * Safe to import from every page entry; the `if` guards make it a no-op
 * on unsupported browsers and on `file://` previews. The registration is
 * deferred to the browser's idle time so it never blocks first paint.
 */

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  const register = () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .catch((err) => {
        console.warn('[pwa] service worker registration failed', err);
      });
  };

  if (document.readyState === 'complete') {
    setTimeout(register, 0);
  } else {
    window.addEventListener('load', () => setTimeout(register, 0), { once: true });
  }
}
