/**
 * Identity module.
 *
 * Two-step phone OTP. When Supabase is configured (see src/supabase.js), real
 * Phone Auth is used and a row in `profiles` mirrors the user's display name.
 * When Supabase is not configured, the original Phase-0 mocked flow runs out
 * of localStorage so the rest of the app keeps working in dev / demo mode.
 *
 * Public API never changes:
 *   getCurrentUser()
 *   requestOtp(phone)
 *   verifyOtp(phone, code)
 *   setName(name)
 *   clearUser()
 *   getAuthHeaders()
 */

import { isSupabaseEnabled, getSupabase } from './supabase.js';

const LS_USER = 'form_user';
const LS_PENDING = 'form_pending_phone';

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function readLocalUser() {
  try {
    const raw = localStorage.getItem(LS_USER);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && typeof u.phone === 'string' && u.phone) {
      return {
        name: typeof u.name === 'string' ? u.name : '',
        phone: u.phone,
        userId: typeof u.userId === 'string' ? u.userId : null,
      };
    }
  } catch {
    /* invalid */
  }
  return null;
}

function writeLocalUser(user) {
  try {
    localStorage.setItem(LS_USER, JSON.stringify(user));
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronous read of the cached user. The Supabase path mirrors the auth
 * session into the same `form_user` slot on every successful verifyOtp /
 * setName call, so callers can stay synchronous on the hot path.
 */
export function getCurrentUser() {
  return readLocalUser();
}

export async function requestOtp(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) {
    return { ok: false, reason: 'invalid_phone' };
  }

  if (isSupabaseEnabled()) {
    const sb = await getSupabase();
    if (sb) {
      const { error } = await sb.auth.signInWithOtp({
        phone: normalized,
        options: { channel: 'sms' },
      });
      if (error) {
        console.warn('[auth] supabase requestOtp error', error);
        return { ok: false, reason: error.message || 'supabase_error' };
      }
      try { localStorage.setItem(LS_PENDING, normalized); } catch { /* ignore */ }
      return { ok: true, phone: normalized };
    }
  }

  try {
    localStorage.setItem(LS_PENDING, normalized);
  } catch {
    return { ok: false, reason: 'storage' };
  }
  return { ok: true, phone: normalized };
}

export async function verifyOtp(phone, code) {
  const normalized = normalizePhone(phone);
  const cleanCode = String(code || '').replace(/[^\d]/g, '');
  if (cleanCode.length !== 6) return { ok: false, reason: 'invalid_code' };

  if (isSupabaseEnabled()) {
    const sb = await getSupabase();
    if (sb) {
      const { data, error } = await sb.auth.verifyOtp({
        phone: normalized,
        token: cleanCode,
        type: 'sms',
      });
      if (error || !data?.user) {
        console.warn('[auth] supabase verifyOtp error', error);
        return { ok: false, reason: error?.message || 'invalid_code' };
      }
      const userId = data.user.id;
      const { data: profile } = await sb
        .from('profiles')
        .select('display_name')
        .eq('user_id', userId)
        .maybeSingle();
      const existingName = profile?.display_name || '';
      const user = { name: existingName, phone: normalized, userId };
      writeLocalUser(user);
      try { localStorage.removeItem(LS_PENDING); } catch { /* ignore */ }
      return { ok: true, user, isFirstLogin: !existingName };
    }
  }

  let pending = '';
  try {
    pending = localStorage.getItem(LS_PENDING) || '';
  } catch {
    /* ignore */
  }
  if (pending && pending !== normalized) {
    return { ok: false, reason: 'phone_mismatch' };
  }

  const existing = readLocalUser();
  const user = {
    name: existing?.name || '',
    phone: normalized,
    userId: existing?.userId || null,
  };
  if (!writeLocalUser(user)) return { ok: false, reason: 'storage' };
  try { localStorage.removeItem(LS_PENDING); } catch { /* ignore */ }
  return { ok: true, user, isFirstLogin: !existing?.name };
}

/** Set or update the display name. Used on first login or from the You page. */
export function setName(name) {
  const user = readLocalUser();
  if (!user) return false;
  const trimmed = String(name || '').trim();
  const next = { ...user, name: trimmed };
  writeLocalUser(next);

  if (isSupabaseEnabled() && user.userId) {
    getSupabase().then((sb) => {
      if (!sb) return;
      sb.from('profiles')
        .upsert(
          { user_id: user.userId, display_name: trimmed, phone: user.phone },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) console.warn('[auth] profile upsert failed', error);
        });
    });
  }

  return true;
}

export function clearUser() {
  try {
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_PENDING);
  } catch {
    /* ignore */
  }
  if (isSupabaseEnabled()) {
    getSupabase().then((sb) => {
      sb?.auth?.signOut?.().catch(() => {});
    });
  }
}

export function getAuthHeaders() {
  return {};
}
