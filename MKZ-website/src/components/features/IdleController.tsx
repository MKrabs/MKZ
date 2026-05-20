import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { useMap } from '~/components/map';
import pb from '~/lib/pb';

// ─── Tunables ────────────────────────────────────────────────────────────────

const CHAR_INTERVAL_MS = 80;
const HOLD_DURATION_MS = 10_000;
const BETWEEN_CODES_MS = 400;

export const HOME_PLACEHOLDER = 'Suche hier ...';

export const IDLE_CODE_EVENT = 'idle:plate-code' as const;

export interface IdlePlateCodeEvent extends CustomEvent {
  detail: {
    /** The fully-typed code being shown, or '' when cleared */
    code: string; /** False when the animation has stopped entirely */
    active: boolean;
  };
}

// ─── Logger ──────────────────────────────────────────────────────────────────

const log = (...args: unknown[]) => console.log('[IdleController]', ...args);
const err = (...args: unknown[]) => console.error('[IdleController] ❌', ...args);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const id = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function untype(input: HTMLInputElement, signal: AbortSignal): Promise<void> {
  while (input.placeholder.length > 0) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    input.placeholder = input.placeholder.slice(0, -1);
    await sleep(CHAR_INTERVAL_MS, signal);
  }
}

async function type(input: HTMLInputElement, text: string, signal: AbortSignal): Promise<void> {
  input.placeholder = '';
  for (const char of text) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    input.placeholder += char;
    await sleep(CHAR_INTERVAL_MS, signal);
  }
}

async function fetchRandomCode(): Promise<string> {
  const res = await pb.collection('kennzeichen').getList(1, 1, { sort: '@random' });
  return res.items[0].code;
}

function fireIdleEvent(input: HTMLInputElement, code: string, active: boolean) {
  input.dispatchEvent(new CustomEvent(IDLE_CODE_EVENT, { bubbles: true, detail: { code, active } }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IdleController() {
  const mapCtx = useMap();
  const [inputValue, setInputValue] = createSignal('');

  let loopAbort: AbortController | null = null;

  function stopAnimation(reason: string) {
    log(`stop — ${reason}`);
    loopAbort?.abort();
    loopAbort = null;
  }

  function startAnimation() {
    if (loopAbort) return;
    log('start');
    loopAbort = new AbortController();
    runLoop(loopAbort.signal);
  }

  async function runLoop(signal: AbortSignal) {
    const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
    if (!input || input.value !== '') return;

    const originalPlaceholder = input.placeholder;
    log(`runLoop — originalPlaceholder="${originalPlaceholder}"`);

    try {
      await type(input, HOME_PLACEHOLDER, signal);

      while (!signal.aborted) {
        if (input.value !== '') break;

        await untype(input, signal);
        fireIdleEvent(input, '', true);

        await sleep(BETWEEN_CODES_MS, signal);

        let code: string;
        try {
          code = await fetchRandomCode();
        } catch (e) {
          err('fetch failed', e);
          break;
        }
        if (signal.aborted) break;

        await type(input, code, signal);
        fireIdleEvent(input, code, true);

        await sleep(HOLD_DURATION_MS, signal);

        await untype(input, signal);
        fireIdleEvent(input, '', true);

        await type(input, HOME_PLACEHOLDER, signal);
        await sleep(BETWEEN_CODES_MS, signal);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        err('unexpected error', e);
      }
    } finally {
      input.placeholder = originalPlaceholder;
      fireIdleEvent(input, '', false);
      log('runLoop — exited, placeholder restored');
    }
  }

  // Start when idle + input empty, don't stop when isIdle bounces false
  // (flyTo triggers isIdle=false briefly — user events handle stopping).
  createEffect(() => {
    const idle = mapCtx.isIdle();
    const value = inputValue();
    log(`effect — isIdle=${idle}, inputValue="${value}"`);

    if (!idle) return;
    if (value !== '') {
      stopAnimation('input has value');
      return;
    }
    startAnimation();
  });

  onMount(() => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
    if (!input) {
      err('input not found');
      return;
    }

    setInputValue(input.value);

    const onFocus = () => stopAnimation('focus');
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') stopAnimation(`keydown: ${e.key}`);
    };
    const onInput = () => {
      setInputValue(input.value);
      if (input.value !== '') stopAnimation('input non-empty');
    };
    const onDragStart = () => stopAnimation('map drag');

    input.addEventListener('focus', onFocus);
    input.addEventListener('keydown', onKeydown);
    input.addEventListener('input', onInput);

    // Attach map dragstart once the map instance is available.
    let mapListenerAttached = false;
    createEffect(() => {
      const map = mapCtx.map();
      if (map && !mapListenerAttached) {
        map.on('dragstart', onDragStart);
        mapListenerAttached = true;
      }
    });

    onCleanup(() => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('input', onInput);
      mapCtx.map()?.off('dragstart', onDragStart);
      loopAbort?.abort();
      loopAbort = null;
    });
  });

  return null;
}
