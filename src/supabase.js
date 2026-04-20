/**
 * Supabase client + feature flag.
 *
 * The app keeps working without Supabase — every module that calls into the
 * backend first checks `isSupabaseEnabled()` and falls back to the
 * localStorage path that powered Phase 0 / 1.
 *
 * To enable Supabase, set on `window` (e.g. in a small inline script before
 * any module loads):
 *
 *   <script>
 *     window.SUPABASE_URL = "https://<project>.supabase.co";
 *     window.SUPABASE_ANON_KEY = "<anon-key>";
 *   </script>
 *
 * The actual `@supabase/supabase-js` package is loaded lazily from the public
 * esm.sh CDN the first time the client is requested, so the rest of the app
 * doesn't pay a cold-start cost for a service that may not be configured.
 */

let clientPromise = null;

export function getSupabaseConfig() {
  if (typeof window === 'undefined') return null;
  const url = window.SUPABASE_URL || window.__SUPABASE_URL__;
  const key = window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__;
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseEnabled() {
  return !!getSupabaseConfig();
}

export async function getSupabase() {
  if (!isSupabaseEnabled()) return null;
  if (clientPromise) return clientPromise;
  const cfg = getSupabaseConfig();
  clientPromise = import(
    /* @vite-ignore */ 'https://esm.sh/@supabase/supabase-js@2'
  )
    .then(({ createClient }) =>
      createClient(cfg.url, cfg.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }),
    )
    .catch((err) => {
      console.warn('[supabase] failed to load client', err);
      clientPromise = null;
      return null;
    });
  return clientPromise;
}
