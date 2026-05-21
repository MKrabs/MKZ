import { Component } from 'solid-js';

function getEnvVersion() {
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
  return (
    <span data-testid="app-version-badge" title={`Version: ${getEnvVersion()}`} class="text-xs text-gray-400">
      {getEnvVersion()}
    </span>
  );
};

export default VersionBadge;
