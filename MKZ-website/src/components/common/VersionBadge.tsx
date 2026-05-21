import { Component } from 'solid-js';

function getEnvVersion() {
  // Prefer Vite build-time env, fallback to runtime window.__ENV__ injected by Docker/entrypoint
  const v = (import.meta as any).env?.VITE_APP_VERSION;
  const c = (import.meta as any).env?.VITE_APP_COMMIT;
  if (v) return c ? `${v} · ${c}` : v;
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    const we = (window as any).__ENV__;
    if (we.APP_VERSION) return we.APP_VERSION;
    if (we.APP_COMMIT) return `dev · ${we.APP_COMMIT}`;
  }
  return 'dev';
}

const VersionBadge: Component = () => {
  const text = getEnvVersion();
  return (
    <div data-testid="app-version-badge" title={`Version: ${text}`} class="fixed left-4 bottom-4 z-50">
      <span class="inline-block px-2 py-1 text-xs rounded-md bg-black/30 text-white/80 hover:bg-black/60 hover:text-white transition-opacity opacity-60">{text}</span>
    </div>
  );
};

export default VersionBadge;
