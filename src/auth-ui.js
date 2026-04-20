/**
 * Reusable inline auth flow.
 *
 * mountAuthFlow(rootEl, opts) renders a phone → code → name OTP wizard into
 * any container. Used by:
 *   - the You page (main login surface)
 *   - the masthead "Sign in" chip (opens a shared <dialog>)
 *   - the post-lock-in "Save this form" panel inside the picks preview
 *
 * Options:
 *   onComplete(user)  fired when the user has a verified session (and a name,
 *                     unless they tapped Skip). Always called for both new and
 *                     returning sign-ins.
 *   variant           'page' (default, used inside .you), 'panel' (compact, for
 *                     dialogs / inline prompts). Only changes copy + headings.
 *   headline          override the title.
 *   slug              override the small kicker line above the title.
 *   hint              override the body line under the title.
 *   showFinePrint     boolean, default true on 'page' variant.
 *
 * Returns { destroy } so callers can tear the flow down.
 */

import { requestOtp, verifyOtp, setName, getCurrentUser } from './auth.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function copyFor(variant, kind, overrides = {}) {
  const base = {
    page: {
      phone: {
        slug: 'SIGN THE LEDGER',
        headline: "Who's picking?",
        hint: 'A phone number, a code we text you, your form. That’s it.',
      },
      code: {
        slug: 'VERIFY',
        headline: 'Enter the code',
        hint: '', // filled in dynamically
      },
      name: {
        slug: 'FIRST PICK',
        headline: 'What should we call you?',
        hint: 'Your name shows on the Wall when you’re in the standings.',
      },
    },
    panel: {
      phone: {
        slug: 'SAVE THIS FORM',
        headline: 'Sign in or sign up',
        hint: 'A phone number, a code we text you. Your form follows.',
      },
      code: {
        slug: 'VERIFY',
        headline: 'Enter the 6-digit code',
        hint: '',
      },
      name: {
        slug: 'WELCOME',
        headline: 'What should we call you?',
        hint: 'Shown on the Wall when you’re in the standings.',
      },
    },
  };

  const v = base[variant] || base.page;
  const layer = v[kind] || {};
  return {
    slug: overrides.slug ?? layer.slug,
    headline: overrides.headline ?? layer.headline,
    hint: overrides.hint ?? layer.hint,
  };
}

function phoneTemplate(state, opts) {
  const c = copyFor(opts.variant, 'phone', {
    slug: opts.slug,
    headline: opts.headline,
    hint: opts.hint,
  });
  const errMarkup = state.error
    ? `<p class="id-form__error">${escapeHtml(state.error)}</p>`
    : '';
  const fine = opts.showFinePrint
    ? `<p class="you-login__fineprint">No password. We never share your number.</p>`
    : '';
  return `
    <section class="you-login you-login--${opts.variant}">
      <p class="you-login__slug">${escapeHtml(c.slug)}</p>
      <h2 class="you-login__title">${escapeHtml(c.headline)}</h2>
      <p class="you-login__hint">${escapeHtml(c.hint)}</p>
      <form data-auth-step="phone" class="id-form id-form--inline" novalidate>
        <div class="id-form__field">
          <label class="id-form__label" for="${opts.idPrefix}-phone">Phone</label>
          <input
            class="id-form__input"
            id="${opts.idPrefix}-phone"
            data-auth-input="phone"
            name="phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="(555) 123-4567"
            value="${escapeHtml(state.phone)}"
            ${state.sending ? 'disabled' : ''}
          />
        </div>
        ${errMarkup}
        <div class="id-form__actions id-form__actions--inline">
          <button type="submit" class="id-form__confirm" ${state.sending ? 'disabled' : ''}>
            <span class="id-form__confirm-text">${state.sending ? 'Sending' : 'Send code'}</span>
            <span class="id-form__confirm-mark" aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
      ${fine}
    </section>
  `;
}

function codeTemplate(state, opts) {
  const c = copyFor(opts.variant, 'code', {
    slug: opts.slug,
    headline: opts.headline,
  });
  const errMarkup = state.error
    ? `<p class="id-form__error">${escapeHtml(state.error)}</p>`
    : '';
  return `
    <section class="you-login you-login--${opts.variant}">
      <p class="you-login__slug">${escapeHtml(c.slug)}</p>
      <h2 class="you-login__title">${escapeHtml(c.headline)}</h2>
      <p class="you-login__hint">We sent a 6-digit code to ${escapeHtml(formatPhone(state.phone))}.</p>
      <form data-auth-step="code" class="id-form id-form--inline" novalidate>
        <div class="id-form__field">
          <label class="id-form__label" for="${opts.idPrefix}-code">Code</label>
          <input
            class="id-form__input id-form__input--code"
            id="${opts.idPrefix}-code"
            data-auth-input="code"
            name="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="123456"
            value="${escapeHtml(state.code)}"
            ${state.verifying ? 'disabled' : ''}
          />
        </div>
        ${errMarkup}
        <div class="id-form__actions id-form__actions--inline">
          <button type="button" class="id-form__cancel" data-auth-back>Use a different number</button>
          <button type="submit" class="id-form__confirm" ${state.verifying ? 'disabled' : ''}>
            <span class="id-form__confirm-text">${state.verifying ? 'Verifying' : 'Verify'}</span>
            <span class="id-form__confirm-mark" aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
      <p class="you-login__fineprint">Demo: any 6-digit code works.</p>
    </section>
  `;
}

function nameTemplate(_state, opts) {
  const c = copyFor(opts.variant, 'name', {
    slug: opts.slug,
    headline: opts.headline,
    hint: opts.hint,
  });
  return `
    <section class="you-login you-login--${opts.variant}">
      <p class="you-login__slug">${escapeHtml(c.slug)}</p>
      <h2 class="you-login__title">${escapeHtml(c.headline)}</h2>
      <p class="you-login__hint">${escapeHtml(c.hint)}</p>
      <form data-auth-step="name" class="id-form id-form--inline" novalidate>
        <div class="id-form__field">
          <label class="id-form__label" for="${opts.idPrefix}-name">Name</label>
          <input
            class="id-form__input"
            id="${opts.idPrefix}-name"
            data-auth-input="name"
            name="name"
            type="text"
            autocomplete="given-name"
            placeholder="your name"
          />
        </div>
        <div class="id-form__actions id-form__actions--inline">
          <button type="button" class="id-form__cancel" data-auth-skip>Skip</button>
          <button type="submit" class="id-form__confirm">
            <span class="id-form__confirm-text">Confirm</span>
            <span class="id-form__confirm-mark" aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
    </section>
  `;
}

let mountSeed = 0;

/**
 * Mount the inline auth flow into rootEl. Returns { destroy }.
 * If the user is already signed in and has a name, onComplete fires
 * synchronously and nothing renders.
 */
export function mountAuthFlow(rootEl, opts = {}) {
  if (!rootEl) return { destroy() {} };

  const variant = opts.variant === 'panel' ? 'panel' : 'page';
  const idPrefix = `auth-${++mountSeed}`;
  const merged = {
    variant,
    idPrefix,
    slug: opts.slug,
    headline: opts.headline,
    hint: opts.hint,
    showFinePrint: opts.showFinePrint ?? variant === 'page',
  };
  const onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : () => {};

  const existing = getCurrentUser();
  if (existing && existing.name) {
    onComplete(existing);
    return { destroy() {} };
  }

  const state = {
    step: existing ? 'name' : 'phone',
    phone: existing?.phone || '',
    code: '',
    sending: false,
    verifying: false,
    error: '',
    destroyed: false,
  };

  function render() {
    if (state.destroyed) return;
    if (state.step === 'phone') {
      rootEl.innerHTML = phoneTemplate(state, merged);
    } else if (state.step === 'code') {
      rootEl.innerHTML = codeTemplate(state, merged);
    } else if (state.step === 'name') {
      rootEl.innerHTML = nameTemplate(state, merged);
    }
    attach();
    const focusable = rootEl.querySelector('[data-auth-input]');
    focusable?.focus({ preventScroll: true });
  }

  function attach() {
    const form = rootEl.querySelector('[data-auth-step]');
    if (!form) return;
    const step = form.getAttribute('data-auth-step');
    if (step === 'phone') {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.sending) return;
        const input = rootEl.querySelector('[data-auth-input="phone"]');
        state.sending = true;
        state.error = '';
        render();
        const res = await requestOtp(input?.value || '');
        state.sending = false;
        if (!res.ok) {
          state.error = 'Enter a valid phone number.';
          render();
          return;
        }
        state.phone = res.phone;
        state.step = 'code';
        render();
      });
    } else if (step === 'code') {
      const back = rootEl.querySelector('[data-auth-back]');
      back?.addEventListener('click', () => {
        state.step = 'phone';
        state.code = '';
        state.error = '';
        render();
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.verifying) return;
        const input = rootEl.querySelector('[data-auth-input="code"]');
        const cleanCode = String(input?.value || '').replace(/[^\d]/g, '');
        if (cleanCode.length !== 6) {
          state.error = 'Enter the 6-digit code.';
          render();
          return;
        }
        state.verifying = true;
        state.error = '';
        render();
        const res = await verifyOtp(state.phone, cleanCode);
        state.verifying = false;
        if (!res.ok) {
          state.error = 'That code didn’t verify. Try again.';
          render();
          return;
        }
        if (res.isFirstLogin) {
          state.step = 'name';
          render();
          return;
        }
        onComplete(res.user || getCurrentUser());
      });
    } else if (step === 'name') {
      const skip = rootEl.querySelector('[data-auth-skip]');
      skip?.addEventListener('click', () => {
        onComplete(getCurrentUser());
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = rootEl.querySelector('[data-auth-input="name"]');
        const name = String(input?.value || '').trim();
        if (name) setName(name);
        onComplete(getCurrentUser());
      });
    }
  }

  render();

  return {
    destroy() {
      state.destroyed = true;
      rootEl.replaceChildren();
    },
  };
}

/**
 * Open the shared #auth-dialog modal and mount the auth flow inside it.
 * Returns a Promise that resolves with the resulting user (or null if closed).
 *
 * The host page must include:
 *   <dialog id="auth-dialog" class="auth-dialog">
 *     <article class="auth-dialog__inner">
 *       <button type="button" class="auth-dialog__close" data-auth-close>×</button>
 *       <div data-auth-mount></div>
 *     </article>
 *   </dialog>
 */
export function openAuthDialog(opts = {}) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('auth-dialog');
    if (!dialog) {
      resolve(null);
      return;
    }
    const mount = dialog.querySelector('[data-auth-mount]');
    const closeBtn = dialog.querySelector('[data-auth-close]');
    if (!mount) {
      resolve(null);
      return;
    }

    let settled = false;
    let flow = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      flow?.destroy();
      cleanup();
      try {
        if (dialog.open) dialog.close();
      } catch {
        dialog.removeAttribute('open');
      }
      resolve(value);
    };

    const onCloseBtn = () => finish(null);
    const onBackdrop = (e) => {
      if (e.target === dialog) finish(null);
    };
    const onCancel = () => finish(null);

    function cleanup() {
      closeBtn?.removeEventListener('click', onCloseBtn);
      dialog.removeEventListener('click', onBackdrop);
      dialog.removeEventListener('cancel', onCancel);
    }

    closeBtn?.addEventListener('click', onCloseBtn);
    dialog.addEventListener('click', onBackdrop);
    dialog.addEventListener('cancel', onCancel);

    flow = mountAuthFlow(mount, {
      variant: 'panel',
      ...opts,
      onComplete: (user) => finish(user),
    });

    try {
      if (!dialog.open) dialog.showModal();
    } catch {
      dialog.setAttribute('open', '');
    }
  });
}
