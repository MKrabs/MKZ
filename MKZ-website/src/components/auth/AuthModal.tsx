import { Component, createSignal, onMount, onCleanup, createEffect, Show } from 'solid-js';
import { login, register } from '~/store/auth';

interface AuthModalProps { onClose: () => void; }
type Mode = 'login' | 'register';

const ANIMATION_DURATION_MS = 300;

const AuthModal: Component<AuthModalProps> = (props) => {
  const [mode, setMode] = createSignal<Mode>('login');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [passwordConfirm, setPasswordConfirm] = createSignal('');
  const [name, setName] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [isVisible, setIsVisible] = createSignal(false);
  const [indicatorLeft, setIndicatorLeft] = createSignal(0);
  const [indicatorWidth, setIndicatorWidth] = createSignal(0);
  const [measuredHeight, setMeasuredHeight] = createSignal<number | 'auto'>('auto');

  let enterTimer: any = null;
  let closeTimer: any = null;
  let ro: ResizeObserver | null = null;

  let tabsRef: HTMLDivElement | undefined;
  let loginTabRef: HTMLButtonElement | undefined;
  let registerTabRef: HTMLButtonElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  let backdropRef: HTMLDivElement | undefined;
  let cardRef: HTMLDivElement | undefined;

  onMount(() => {
    enterTimer = setTimeout(() => setIsVisible(true), 8);
    updateIndicator();
    updateMeasuredHeight();

    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { updateIndicator(); updateMeasuredHeight(); });
      if (tabsRef) ro.observe(tabsRef);
      if (contentRef) ro.observe(contentRef);
    } else {
      window.addEventListener('resize', updateIndicator);
    }

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWithAnimation(); };
    window.addEventListener('keydown', onKey);

    onCleanup(() => {
      clearTimeout(enterTimer);
      clearTimeout(closeTimer);
      window.removeEventListener('resize', updateIndicator);
      window.removeEventListener('keydown', onKey);
      if (ro) ro.disconnect();
    });
  });

  createEffect(() => {
    mode();
    requestAnimationFrame(() => requestAnimationFrame(updateIndicator));
    requestAnimationFrame(() => requestAnimationFrame(updateMeasuredHeight));
  });

  function clearError() { setError(null); }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode() === 'login') await login(email(), password());
      else {
        if (password() !== passwordConfirm()) { setError('Passwords do not match.'); return; }
        if (password().length < 8) { setError('Password must be at least 8 characters.'); return; }
        await register(email(), password(), passwordConfirm(), name());
      }
      closeWithAnimation();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to create record') || msg.includes('email')) setError('Email already registered or invalid.');
      else if (msg.includes('credentials') || msg.includes('password')) setError('Invalid email or password.');
      else if (msg.includes('Could not reach') || msg.includes('fetch')) setError('Cannot reach the server. Is PocketBase running?');
      else setError(msg || 'Something went wrong.');
    } finally {
      setLoading(false);
      requestAnimationFrame(() => updateMeasuredHeight());
    }
  }

  function closeWithAnimation() {
    setIsVisible(false);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => props.onClose(), ANIMATION_DURATION_MS);
  }

  function updateIndicator() {
    if (!tabsRef) return;
    const parentRect = tabsRef.getBoundingClientRect();
    const active = mode() === 'login' ? loginTabRef : registerTabRef;
    if (!active) return;
    const r = active.getBoundingClientRect();
    setIndicatorLeft(r.left - parentRect.left + 4);
    setIndicatorWidth(r.width - 8);
  }

  function updateMeasuredHeight() {
    if (!contentRef) return setMeasuredHeight('auto');
    setMeasuredHeight(contentRef.scrollHeight);
  }

  function changeMode(m: Mode) {
    if (m === mode()) return;
    clearError();
    updateMeasuredHeight();
    requestAnimationFrame(() => {
      setTimeout(() => {
        setMode(m);
        setPassword('');
        setPasswordConfirm('');
        requestAnimationFrame(() => requestAnimationFrame(updateMeasuredHeight));
      }, 60);
    });
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && closeWithAnimation()}
      data-testid="auth-modal-backdrop"
    >
      <div
        ref={backdropRef}
        onClick={() => closeWithAnimation()}
        class={`absolute inset-0 bg-black/50 transition-all duration-300 ${isVisible() ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-0'}`}
      />

      <div
        ref={cardRef}
        class={`relative z-10 w-full max-w-sm bg-white/90 rounded-2xl shadow-2xl border border-white/40 p-6 transition-all duration-300 ease-in-out transform ${isVisible() ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-3 scale-95'}`}
        data-testid="auth-modal"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
      >
        <button
          onClick={closeWithAnimation}
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
          data-testid="auth-modal-close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <h2 class="text-xl font-bold text-gray-800 mb-1">{mode() === 'login' ? 'Welcome back' : 'Create account'}</h2>
        <p class="text-sm text-gray-500 mb-5">{mode() === 'login' ? 'Sign in to track your spotted plates.' : 'Start collecting Kennzeichen across Germany.'}</p>

        <div ref={tabsRef} class="relative flex rounded-lg bg-gray-100 p-1 mb-5 gap-1">
          <div
            class="absolute top-1 bottom-1 bg-white rounded-md shadow transition-all duration-250"
            style={{ left: `${indicatorLeft()}px`, width: `${indicatorWidth()}px` }}
            aria-hidden="true"
          />

          <button
            ref={loginTabRef}
            type="button"
            onClick={() => changeMode('login')}
            data-testid="auth-tab-login"
            class={`relative z-10 flex-1 py-1.5 text-sm font-medium rounded-md ${mode() === 'login' ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign In
          </button>

          <button
            ref={registerTabRef}
            type="button"
            onClick={() => changeMode('register')}
            data-testid="auth-tab-register"
            class={`relative z-10 flex-1 py-1.5 text-sm font-medium rounded-md ${mode() === 'register' ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Register
          </button>
        </div>

        <div style={{ overflow: 'hidden', height: measuredHeight() === 'auto' ? 'auto' : `${measuredHeight()}px`, transition: 'height 220ms ease' }}>
          <div ref={contentRef} class="space-y-4" data-testid="auth-form">
            <Show when={mode() === 'register'}>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Display name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name()}
                  onInput={(e) => { setName(e.currentTarget.value); clearError(); }}
                  class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
                  data-testid="auth-name-input"
                />
              </div>
            </Show>

            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                required
                value={email()}
                onInput={(e) => { setEmail(e.currentTarget.value); clearError(); }}
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
                data-testid="auth-email-input"
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
                value={password()}
                onInput={(e) => { setPassword(e.currentTarget.value); clearError(); }}
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
                data-testid="auth-password-input"
              />
            </div>

            <Show when={mode() === 'register'}>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={passwordConfirm()}
                  onInput={(e) => { setPasswordConfirm(e.currentTarget.value); clearError(); }}
                  class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
                  data-testid="auth-confirm-input"
                />
              </div>
            </Show>

            <Show when={error()}>
              <p class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2" data-testid="auth-error">
                <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                {error()}
              </p>
            </Show>

            <div>
              <button
                type="submit"
                disabled={loading()}
                class="w-full py-2.5 bg-mkz-primary text-white text-sm font-semibold rounded-lg hover:bg-mkz-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleSubmit}
                data-testid="auth-submit"
              >
                {loading() ? (mode() === 'login' ? 'Signing in…' : 'Creating account…') : (mode() === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
