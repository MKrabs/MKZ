import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { useMap } from '~/components/map';

/**
 * Minimal IdleController:
 * - If the submission input is empty and the map is idle for 5s, set idle = true
 * - Otherwise idle = false
 * - While idle, log that an action would be fired ("idle action: would input city code")
 */

const IDLE_MS = 5000;
const BETWEEN_MS = 5000; // wait after typing before zoom/pan
const SAMPLE_CODES = ['M', 'B', 'KA', 'F', 'K', 'D', 'S'];

const IdleController: Component = () => {
  const mapCtx = useMap();

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idle = false;
  let runningSequence = false;

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function evaluateIdle() {
    clearIdleTimer();

    const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
    const inputVal = input?.value ?? '';
    const mapIsIdle = mapCtx.isIdle();

    if (mapIsIdle && inputVal.trim() === '') {
      // schedule idle after timeout
      idleTimer = setTimeout(() => {
        idle = true;
        console.log('user idle');
        // start performing actions
        startIdleSequence();
      }, IDLE_MS);
    } else {
      if (idle) {
        idle = false;
        console.log('idle false');
        stopIdleSequence();
      }
    }
  }

  async function startIdleSequence() {
    if (runningSequence) return;
    runningSequence = true;
    while (idle) {
      // pick a random city code
      const code = SAMPLE_CODES[Math.floor(Math.random() * SAMPLE_CODES.length)];
      const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
      if (!input) break;

      // type into placeholder character by character (does not fire input events)
      const originalPlaceholder = input.getAttribute('placeholder') ?? '';
      for (let i = 1; i <= code.length && idle; i++) {
        input.setAttribute('placeholder', code.slice(0, i));
        await new Promise<void>((r) => (idle ? setTimeout(r, 200) : r()));
      }

      // wait BEFORE zoom/pan
      await new Promise<void>((r) => (idle ? setTimeout(r, BETWEEN_MS) : r()));
      if (!idle) {
        input.setAttribute('placeholder', originalPlaceholder);
        break;
      }

      // zoom out to Germany view then pan a bit
      try {
        mapCtx.flyToCoords([10.0, 51.0], 5);
        const dx = (Math.random() - 0.5) * 2;
        const dy = (Math.random() - 0.5) * 2;
        mapCtx.flyToCoords([10.0 + dx, 51.0 + dy], 5);
      } catch (e) {
        // ignore
      }

      // clear placeholder
      input.setAttribute('placeholder', originalPlaceholder);

      // wait a short interval before next code
      await new Promise<void>((r) => (idle ? setTimeout(r, 1000) : r()));
    }
    runningSequence = false;
  }

  function stopIdleSequence() {
    runningSequence = false;
    // clearing idle will break the loop
  }

  onMount(() => {
    const input = document.querySelector('[data-testid="license-plate-input"]');
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      // ignore programmatic changes if flagged
      if (t?.dataset?.mkzProgrammatic === '1') return;

      // user typed: log action, cancel any scheduled idle and re-evaluate
      console.log('action: typing');
      clearIdleTimer();
      if (idle) {
        idle = false;
        console.log('idle false');
      }
      evaluateIdle();
    };

    if (input) input.addEventListener('input', onInput as EventListener);
    // also attach a document-level listener to catch events reliably in tests
    document.addEventListener('input', onInput as EventListener);

    // initial evaluation
    evaluateIdle();

    onCleanup(() => {
      if (input) input.removeEventListener('input', onInput as EventListener);
      document.removeEventListener('input', onInput as EventListener);
      clearIdleTimer();
    });
  });

  // react to map idle state changes (accessor read will subscribe)
  createEffect(() => {
    mapCtx.isIdle();
    evaluateIdle();
  });

  return null;
};

export default IdleController;
