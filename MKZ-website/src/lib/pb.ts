/**
 * PocketBase singleton.
 *
 * URL resolution order:
 *  1. window.__ENV__.PB_URL   — injected at container start by docker-entrypoint.sh
 *  2. import.meta.env.VITE_PB_URL — set at Vite build time (CI or local override)
 *  3. http://127.0.0.1:8090   — local dev fallback
 *
 * This means Docker images never need to be rebuilt when the backend URL changes —
 * just restart the container with a different PB_URL environment variable.
 */
import PocketBase from 'pocketbase';

function resolvePbUrl(): string {
  try {
    const runtimeUrl = (window as any).__ENV__?.PB_URL;
    // Use typeof check — NOT a truthy check — so that an empty string (same-origin
    // mode set by docker-entrypoint.sh) is returned as-is instead of falling
    // through to the hardcoded 127.0.0.1 loopback fallback.
    // PocketBase SDK treats "" as same-origin relative paths (/api/…),
    // which Caddy then proxies internally to localhost:8090.
    if (typeof runtimeUrl === 'string') return runtimeUrl;
  } catch {
    // Non-browser environment (SSR, tests)
  }
  return import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090';
}

const pb = new PocketBase(resolvePbUrl());

pb.autoCancellation(false);

export default pb;
