import { Component, createSignal, Show } from 'solid-js';
import { login, register } from '~/store/auth';

interface AuthModalProps {
  onClose: () => void;
}

type Mode = 'login' | 'register';

const AuthModal: Component<AuthModalProps> = (props) => {
  const [mode, setMode] = createSignal<Mode>('login');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [passwordConfirm, setPasswordConfirm] = createSignal('');
  const [name, setName] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const clearError = () => setError(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode() === 'login') {
        await login(email(), password());
      } else {
        if (password() !== passwordConfirm()) {
          setError('Passwords do not match.');
          return;
        }
        if (password().length < 8) {
          setError('Password must be at least 8 characters.');
          return;
        }
        await register(email(), password(), passwordConfirm(), name());
      }
      props.onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // PocketBase wraps errors in a verbose JSON — try to extract just the useful part
      if (msg.includes('Failed to create record') || msg.includes('email')) {
        setError('Email already registered or invalid.');
      } else if (msg.includes('credentials') || msg.includes('password')) {
        setError('Invalid email or password.');
      } else if (msg.includes('Could not reach') || msg.includes('fetch')) {
        setError('Cannot reach the server. Is PocketBase running?');
      } else {
        setError(msg || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearError();
    setPassword('');
    setPasswordConfirm('');
  };

  return (/* Backdrop */
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
      data-testid="auth-modal-backdrop"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"/>

      {/* Modal card */}
      <div
        class="relative z-10 w-full max-w-sm bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/40 p-6"
        data-testid="auth-modal"
      >
        {/* Close button */}
        <button
          onClick={props.onClose}
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
          data-testid="auth-modal-close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        {/* Title */}
        <h2 class="text-xl font-bold text-gray-800 mb-1">
          {mode() === 'login' ? 'Welcome back' : 'Create account'}
        </h2>
        <p class="text-sm text-gray-500 mb-5">
          {mode() === 'login' ? 'Sign in to track your spotted plates.'
            : 'Start collecting Kennzeichen across Germany.'}
        </p>

        {/* Mode tabs */}
        <div class="flex rounded-lg bg-gray-100 p-1 mb-5 gap-1">
          {(['login', 'register'] as Mode[]).map((m) => (<button
              type="button"
              onClick={() => switchMode(m)}
              data-testid={`auth-tab-${m}`}
              class={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${mode() === m
                ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>))}
        </div>

        <form onSubmit={handleSubmit} class="space-y-4" data-testid="auth-form">
          {/* Name — register only */}
          <Show when={mode() === 'register'}>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Display name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name()}
                onInput={(e) => {
                  setName(e.currentTarget.value);
                  clearError();
                }}
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
                data-testid="auth-name-input"
              />
            </div>
          </Show>

          {/* Email */}
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              required
              value={email()}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
                clearError();
              }}
              class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
              data-testid="auth-email-input"
            />
          </div>

          {/* Password */}
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              value={password()}
              onInput={(e) => {
                setPassword(e.currentTarget.value);
                clearError();
              }}
              class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
              data-testid="auth-password-input"
            />
          </div>

          {/* Confirm password — register only */}
          <Show when={mode() === 'register'}>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Confirm password</label>
              <input
                type="password"
                placeholder="••••••••"
                required
                value={passwordConfirm()}
                onInput={(e) => {
                  setPasswordConfirm(e.currentTarget.value);
                  clearError();
                }}
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-mkz-primary/30 focus:border-mkz-primary transition-colors"
                data-testid="auth-confirm-input"
              />
            </div>
          </Show>

          {/* Error message */}
          <Show when={error()}>
            <p
              class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-2"
              data-testid="auth-error"
            >
              <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clip-rule="evenodd"/>
              </svg>
              {error()}
            </p>
          </Show>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading()}
            class="w-full py-2.5 bg-mkz-primary text-white text-sm font-semibold rounded-lg hover:bg-mkz-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="auth-submit"
          >
            {loading() ? (mode() === 'login' ? 'Signing in…' : 'Creating account…') : (mode() === 'login' ? 'Sign In'
              : 'Create Account')}
          </button>
        </form>
      </div>
    </div>);
};

export default AuthModal;
