import { onMount, onCleanup, createEffect, createSignal } from 'solid-js';
import { useMap } from '~/components/map';
import pb from '../../lib/pb';
import type maplibregl from 'maplibre-gl';

/**
 * IdleController.tsx
 *
 * Fires a custom "idle:plate-code" event on the input whenever the animation
 * types a new code, so PlateSubmission can react to it via its normal lookup
 * path (setPlateText → scheduleLookupFor) without any MutationObserver hacks.
 */


// ─── Tunables ────────────────────────────────────────────────────────────────

const CHAR_INTERVAL_MS = 80;
const HOLD_DURATION_MS = 10_000;
const BETWEEN_CODES_MS = 400;
const IDLE_STOP_DEBOUNCE_MS = 4_000;
export const HOME_PLACEHOLDER = 'Suche hier …';

/**
 * Custom event name fired on the input element.
 * PlateSubmission listens for this to drive its lookup.
 */
export const IDLE_CODE_EVENT = 'idle:plate-code' as const;

export interface IdlePlateCodeEvent extends CustomEvent {
  detail: {
    /** The code currently being shown, or '' when cleared back to home */
    code: string;
    /** True when the animation is actively running (false = idle stopped) */
    active: boolean;
  };
}

function fireIdleEvent(input: HTMLInputElement, code: string, active: boolean) {
  input.dispatchEvent(
    new CustomEvent(IDLE_CODE_EVENT, {
      bubbles: true,
      detail: { code, active },
    }) satisfies IdlePlateCodeEvent,
  );
  log(`fireIdleEvent() — code="${code}", active=${active}`);
}

// ─── Logger ───────────────────────────────────────────────────────────────────

const TAG = '[IdleController]';
const log = (...args: unknown[]) => console.log(TAG, ...args);
const warn = (...args: unknown[]) => console.warn(TAG, '⚠️', ...args);
const err = (...args: unknown[]) => console.error(TAG, '❌', ...args);

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

async function untypeText(
  setText: (s: string) => void,
  getText: () => string,
  signal: AbortSignal,
  label: string,
): Promise<void> {
  log(`untype("${label}") — start, text="${getText()}"`);
  while (getText().length > 0) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    setText(getText().slice(0, -1));
    await sleep(CHAR_INTERVAL_MS, signal);
  }
  log(`untype("${label}") — done`);
}

async function typeText(
  setText: (s: string | ((p: string) => string)) => void,
  text: string,
  signal: AbortSignal,
  label: string,
): Promise<void> {
  log(`typeText("${label}") — typing "${text}"`);
  setText('');
  for (const char of text) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    setText((prev: string) => prev + char);
    await sleep(CHAR_INTERVAL_MS, signal);
  }
  log(`typeText("${label}") — done`);
}

async function fetchRandomCode(): Promise<string> {
  log('fetchRandomCode() — fetching…');
  const res = await pb.collection('kennzeichen').getList(1, 1, { sort: '@random' });
  const code = res.items[0].code;
  log(`fetchRandomCode() — got "${code}"`);
  return code;
}

function createPlaceholderOverlay(input: HTMLInputElement): {
  setText: (s: string | ((prev: string) => string)) => void;
  getText: () => string;
  destroy: () => void;
} {
  let anchor: HTMLElement = input.parentElement as HTMLElement;
  while (anchor && anchor !== document.body) {
    const pos = getComputedStyle(anchor).position;
    if (pos !== 'static') break;
    anchor = anchor.parentElement as HTMLElement;
  }
  if (!anchor) anchor = document.body;

  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.setAttribute('data-idle-overlay', 'true');

  const inputStyle = getComputedStyle(input);
  const inputRect = input.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();

  Object.assign(span.style, {
    position: 'absolute',
    top: `${inputRect.top - anchorRect.top + anchor.scrollTop}px`,
    left: `${inputRect.left - anchorRect.left + anchor.scrollLeft}px`,
    width: `${inputRect.width}px`,
    height: `${inputRect.height}px`,
    lineHeight: `${inputRect.height}px`,
    paddingTop: inputStyle.paddingTop,
    paddingRight: inputStyle.paddingRight,
    paddingBottom: inputStyle.paddingBottom,
    paddingLeft: inputStyle.paddingLeft,
    fontSize: inputStyle.fontSize,
    fontFamily: inputStyle.fontFamily,
    fontWeight: inputStyle.fontWeight,
    letterSpacing: inputStyle.letterSpacing,
    color: inputStyle.color,
    opacity: '0.5',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '9999',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    boxSizing: 'border-box',
  });

  anchor.appendChild(span);
  log('createPlaceholderOverlay() — overlay mounted');

  let currentText = '';
  const setText = (s: string | ((prev: string) => string)) => {
    currentText = typeof s === 'function' ? s(currentText) : s;
    span.textContent = currentText;
  };
  const getText = () => currentText;
  const destroy = () => {
    span.remove();
    log('createPlaceholderOverlay() — overlay removed');
  };

  return { setText, getText, destroy };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function IdleController() {
  const mapCtx = useMap();
  const [inputValue, setInputValue] = createSignal('');

  let loopAbort: AbortController | null = null;
  let idleStopDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Stop ──────────────────────────────────────────────────────────────────

  function stopAnimation(reason: string) {
    log(`stopAnimation() — reason="${reason}", loopAbort=${loopAbort ? 'exists' : 'null'}`);
    if (idleStopDebounceTimer) {
      clearTimeout(idleStopDebounceTimer);
      idleStopDebounceTimer = null;
    }
    if (!loopAbort) {
      log('stopAnimation() — nothing running, no-op');
      return;
    }
    loopAbort.abort();
    loopAbort = null;
    log('stopAnimation() — loop aborted');
  }

  function scheduleStop(reason: string) {
    if (idleStopDebounceTimer) clearTimeout(idleStopDebounceTimer);
    log(`scheduleStop() — debouncing ${IDLE_STOP_DEBOUNCE_MS}ms, reason="${reason}"`);
    idleStopDebounceTimer = setTimeout(() => {
      idleStopDebounceTimer = null;
      stopAnimation(reason);
    }, IDLE_STOP_DEBOUNCE_MS);
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  async function runLoop(signal: AbortSignal) {
    log('runLoop() — entered');

    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="license-plate-input"]',
    );
    if (!input) { err('runLoop() — input not found'); return; }
    if (input.value !== '') { warn(`runLoop() — input has value, not starting`); return; }

    log(`runLoop() — input.placeholder="${input.placeholder}", value="${input.value}"`);

    // Snapshot whatever the placeholder currently says so we can restore it on exit.
    const originalPlaceholder = input.placeholder;

    let iteration = 0;

    try {
      // Type the home text into the real placeholder to start.
      log('runLoop() — typing HOME_PLACEHOLDER into input.placeholder');
      await typeText(
        (s) => { input.placeholder = typeof s === 'function' ? s(input.placeholder) : s; },
        HOME_PLACEHOLDER,
        signal,
        'initial-home',
      );

      while (!signal.aborted) {
        iteration++;
        log(`── iteration #${iteration} ──`);

        if (input.value !== '') {
          warn(`  input.value="${input.value}", stopping`);
          break;
        }

        // 1. Untype current placeholder.
        log(`  step 1: untype placeholder`);
        await untypeText(
          (s) => { input.placeholder = s; },
          () => input.placeholder,
          signal,
          `iter${iteration}-untype`,
        );
        fireIdleEvent(input, '', true);

        // 2. Pause.
        log(`  step 2: pause ${BETWEEN_CODES_MS}ms`);
        await sleep(BETWEEN_CODES_MS, signal);

        // 3. Fetch.
        log(`  step 3: fetch random code`);
        let code: string;
        try {
          code = await fetchRandomCode();
        } catch (fetchErr) {
          err(`  fetch failed`, fetchErr);
          break;
        }
        if (signal.aborted) break;

        // 4. Type code into placeholder.
        log(`  step 4: type code="${code}"`);
        await typeText(
          (s) => { input.placeholder = typeof s === 'function' ? s(input.placeholder) : s; },
          code,
          signal,
          `iter${iteration}-code`,
        );
        fireIdleEvent(input, code, true);
        log(`  step 4: fired idle event with code="${code}"`);

        // 5. Hold.
        log(`  step 5: hold ${HOLD_DURATION_MS}ms`);
        await sleep(HOLD_DURATION_MS, signal);

        // 6. Untype code.
        log(`  step 6: untype code`);
        await untypeText(
          (s) => { input.placeholder = s; },
          () => input.placeholder,
          signal,
          `iter${iteration}-code-untype`,
        );
        fireIdleEvent(input, '', true);

        // 7. Re-type home placeholder.
        log(`  step 7: type HOME_PLACEHOLDER`);
        await typeText(
          (s) => { input.placeholder = typeof s === 'function' ? s(input.placeholder) : s; },
          HOME_PLACEHOLDER,
          signal,
          `iter${iteration}-home`,
        );

        // 8. Pause before next iteration.
        log(`  step 8: pause ${BETWEEN_CODES_MS}ms`);
        await sleep(BETWEEN_CODES_MS, signal);

        log(`── iteration #${iteration} complete ──`);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        log(`runLoop() — AbortError at iteration #${iteration}, clean exit`);
      } else {
        err('runLoop() — unexpected error', e);
      }
    } finally {
      // Restore whatever was there before we started.
      input.placeholder = originalPlaceholder;
      fireIdleEvent(input, '', false);
      log(`runLoop() — finally: placeholder restored to "${originalPlaceholder}", idle event fired`);
    }
  }

  // ── Start ─────────────────────────────────────────────────────────────────

  function startAnimation() {
    log(`startAnimation() — loopAbort=${loopAbort ? 'running' : 'null'}`);
    if (loopAbort) {
      warn('startAnimation() — already running');
      return;
    }
    if (idleStopDebounceTimer) {
      clearTimeout(idleStopDebounceTimer);
      idleStopDebounceTimer = null;
    }
    loopAbort = new AbortController();
    runLoop(loopAbort.signal);
  }

  // ── Reactive ──────────────────────────────────────────────────────────────

  createEffect(() => {
    const idle = mapCtx.isIdle();
    const value = inputValue();
    log(`createEffect(idle+value) — isIdle=${idle}, inputValue="${value}"`);

    // ⚠️ KEY CHANGE: we no longer stop the animation when isIdle goes false.
    // isIdle bounces false during every flyTo (including ones WE trigger via
    // the idle lookup). Stopping on isIdle=false was killing the loop every
    // single cycle. User-driven stops happen via focus/keydown/drag listeners.
    if (!idle) {
      // Only start if not already running — don't stop.
      log('createEffect(idle+value) — not idle, leaving animation state as-is');
      return;
    }

    // Cancel any pending debounced stop since we're back to idle.
    if (idleStopDebounceTimer) {
      clearTimeout(idleStopDebounceTimer);
      idleStopDebounceTimer = null;
      log('createEffect(idle+value) — cancelled pending stop, isIdle is true again');
    }

    if (value !== '') {
      if (loopAbort) stopAnimation('input has value');
      return;
    }

    // isIdle=true + empty input: start if not already running.
    startAnimation();
  });

  // ── Listeners ─────────────────────────────────────────────────────────────

  onMount(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="license-plate-input"]',
    );
    if (!input) {
      err('onMount() — input not found');
      return;
    }

    log(`onMount() — input found, placeholder="${input.placeholder}", value="${input.value}"`);
    setInputValue(input.value);

    const handleFocus = () => {
      log('event: focus');
      stopAnimation('focus');
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        log(`event: keydown "${e.key}"`);
        stopAnimation(`keydown: ${e.key}`);
      }
    };
    const handleInputEvent = () => {
      const val = input.value;
      log(`event: input value="${val}"`);
      setInputValue(val);
      if (val !== '' && loopAbort) stopAnimation('input non-empty');
    };
    const handleMapDrag = () => {
      log('event: dragstart');
      stopAnimation('map drag');
    };

    input.addEventListener('focus', handleFocus);
    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('input', handleInputEvent);

    let mapListenerAttached = false;
    const attachMapListener = (map: maplibregl.Map) => {
      if (mapListenerAttached) return;
      map.on('dragstart', handleMapDrag);
      mapListenerAttached = true;
      log('onMount() — dragstart attached');
    };

    const existing = mapCtx.map();
    if (existing) attachMapListener(existing);
    createEffect(() => {
      const m = mapCtx.map();
      if (m) attachMapListener(m);
    });

    onCleanup(() => {
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('keydown', handleKeydown);
      input.removeEventListener('input', handleInputEvent);
      mapCtx.map()?.off('dragstart', handleMapDrag);
      if (idleStopDebounceTimer) clearTimeout(idleStopDebounceTimer);
      loopAbort?.abort();
      loopAbort = null;
    });
  });

  return null;
}
