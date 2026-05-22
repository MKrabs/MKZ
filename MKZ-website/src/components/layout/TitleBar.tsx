import { Component, createSignal, Show } from 'solid-js';
import { Button } from '~/components/common';
import Icon from '../common/Icon';
import { logout, user } from '~/store/auth';
import { AuthModal } from '../auth';
import ProfileAvatar from '../common/ProfileAvatar';
import VersionBadge from '../common/VersionBadge';

const TitleBar: Component = () => {
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [authOpen, setAuthOpen] = createSignal(false);

  return (<div class="pointer-events-auto">
      <header class="sticky bg-white/80 backdrop-blur-md shadow p-4 flex items-center justify-between">
        {/* App name */}
        <h1 class="font-display text-2xl font-bold text-mkz-primary tracking-wide select-none">
          MKZ
        </h1>

        <Show
          when={user()}
          fallback={
            <Button
              variant={'accent'}
              onClick={() => setAuthOpen(true)}
              class="flex transition-colors"
              data-testid="sign-in-btn"
              icon={<Icon name="user"/>}
            >
              Sign In
            </Button>}
        >
          {/* Signed in → user menu */}
          <Button
            onClick={() => setMenuOpen(!menuOpen())}
            variant="ghost"
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
            <Icon name="chevron-down" class="w-4 h-4 text-gray-400" />
          </Button>
        </Show>
      </header>

      {/* Signed-in side menu */}
      <Show when={menuOpen() && user()}>
        <div class="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div class="absolute inset-0 bg-black/30"/>
          <aside
            class="absolute right-0 top-0 h-full w-72 bg-white shadow-xl p-6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
            data-testid="side-menu"
          >
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">Menu</h2>
                <Button onClick={() => setMenuOpen(false)} variant="ghost" size="sm" class="text-gray-400 hover:text-gray-600 p-0">
                  <Icon name="x" class="w-6 h-6" />
                </Button>
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
                <Button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  variant="ghost"
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                  data-testid="logout-btn"
                >
                  <Icon name="log-out" />
                  Sign Out
                </Button>
              </div>
            </div>

            <div class="mt-3 text-xs text-gray-400">
              <div class="mb-1">Version: <VersionBadge/></div>
              <div>Made with love by Mkrabs</div>
            </div>
          </aside>
        </div>
      </Show>

      {/* Auth modal */}
      <Show when={authOpen()}>
        <AuthModal onClose={() => setAuthOpen(false)}/>
      </Show>
    </div>);
};

export default TitleBar;
