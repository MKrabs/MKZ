/**
 * Reactive auth state for the whole app.
 *
 * PocketBase SDK stores the token in localStorage and exposes `authStore`.
 * We bridge it into SolidJS signals so components stay reactive.
 */
import type { RecordModel } from 'pocketbase';
import { createSignal } from 'solid-js';
import pb from '../lib/pb';

// Initialise from what's already in localStorage (persisted session)
const [user, setUser] = createSignal<RecordModel | null>(pb.authStore.isValid
  ? (pb.authStore.model as RecordModel | null) : null);

// Stay in sync when the SDK changes auth state (login, logout, token refresh)
pb.authStore.onChange((_token, model) => {
  setUser(model as RecordModel | null);
});

/** Sign in with email + password. */
async function login(email: string, password: string): Promise<void> {
  await pb.collection('users').authWithPassword(email, password);
}

/** Register a new account. */
async function register(email: string, password: string, passwordConfirm: string, name: string): Promise<void> {
  await pb.collection('users').create({ email, password, passwordConfirm, name });
  // Auto-sign-in after registration
  await pb.collection('users').authWithPassword(email, password);
}

/** Sign out the current user. */
function logout(): void {
  pb.authStore.clear();
}

export { user, setUser, login, register, logout };
