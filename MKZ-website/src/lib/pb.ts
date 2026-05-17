/**
 * PocketBase singleton.
 *
 * The SDK handles:
 * - Token storage in localStorage (persists across refreshes)
 * - Automatic token refresh
 * - Auth state management via authStore
 *
 * Direct URL (no Vite proxy needed – PocketBase ships CORS-open by default).
 */
import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090';

const pb = new PocketBase(PB_URL);

// Keep PocketBase quiet about auto-cancel warnings in dev
pb.autoCancellation(false);

export default pb;
