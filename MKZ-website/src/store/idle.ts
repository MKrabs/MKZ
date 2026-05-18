import { createSignal } from 'solid-js';

const LS_KEY = 'mkz:idleEnabled';

function readInitial(): boolean {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === null) return true;
    return v === '1' || v === 'true';
  } catch {
    return true;
  }
}

const [idleEnabled, setIdleEnabledSignal] = createSignal<boolean>(readInitial());

function setIdleEnabled(v: boolean) {
  try {
    localStorage.setItem(LS_KEY, v ? '1' : '0');
  } catch {}
  setIdleEnabledSignal(v);
}

export { idleEnabled, setIdleEnabled };
