import { Component, createSignal, Show } from 'solid-js';
import ProfileAvatar from '../common/ProfileAvatar';
import { AuthModal } from '../auth';
import { user, logout } from '~/store/auth';

const TitleBar: Component = () => {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [authOpen, setAuthOpen] = createSignal(false);

  return (
    <>
      <header class="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/30 shadow-sm">
        <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* App name */}
          <h1 class="font-display text-2xl font-bold text-mkz-primary tracking-wide select-none">
            MKZ
          </h1>

          <Show
            when={user()}
            fallback={
              /* Not signed in → Sign In button */
              <button
                onClick={() => setAuthOpen(true)}
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mkz-primary text-white text-sm font-medium hover:bg-mkz-secondary transition-colors"
                data-testid="sign-in-btn"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Sign In
              </button>
            }
          >
            {/* Signed in → user menu */}
            <button
              onClick={() => setMenuOpen(!menuOpen())}
              class="flex items-center gap-2 hover:bg-white/50 rounded-lg px-2 py-1 transition-colors"
              data-testid="user-menu-trigger"
            >
              <span class="text-sm font-medium text-gray-700 hidden sm:block">
                {(user()?.name as string) || (user()?.email as string) || 'Account'}
              </span>
              <ProfileAvatar
                name={(user()?.name as string) || (user()?.email as string) || '?'}
                imageUrl={null}
                size="sm"
              />
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </Show>
        </div>
      </header>

      {/* Signed-in side menu */}
      <Show when={menuOpen() && user()}>
        <div class="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div class="absolute inset-0 bg-black/30" />
          <aside
            class="absolute right-0 top-0 h-full w-72 bg-white shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
            data-testid="side-menu"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Menu</h2>
              <button onClick={() => setMenuOpen(false)} class="text-gray-400 hover:text-gray-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="flex items-center gap-3 py-3 border-b">
              <ProfileAvatar
                name={(user()?.name as string) || (user()?.email as string) || '?'}
                imageUrl={null}
                size="lg"
              />
              <div>
                <p class="font-semibold">{(user()?.name as string) || 'Anonymous'}</p>
                <p class="text-sm text-gray-500 truncate">{user()?.email as string}</p>
              </div>
            </div>

            <nav class="space-y-1">
              <a href="#" class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700">Profile</a>
              <a href="#" class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700">My Collection</a>
              <a href="#" class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700">Challenges</a>
              <a href="#" class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700">Settings</a>
            </nav>

            <div class="pt-2 border-t">
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                data-testid="logout-btn"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      </Show>

      {/* Auth modal */}
      <Show when={authOpen()}>
        <AuthModal onClose={() => setAuthOpen(false)} />
      </Show>
    </>
  );
};

export default TitleBar;
