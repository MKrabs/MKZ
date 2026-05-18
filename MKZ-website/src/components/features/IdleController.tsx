import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { useMap } from '../map/MapContext';

/**
 * Minimal IdleController:
 * - If the submission input is empty and the map is idle for 5s, set idle = true
 * - Otherwise idle = false
 * - While idle, log that an action would be fired ("idle action: would input city code")
 */

const IDLE_MS = 5000;

const IdleController: Component = () => {
  const mapCtx = useMap();

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idle = false;

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
        console.log('idle action: would input city code');
      }, IDLE_MS);
    } else {
      if (idle) {
        idle = false;
        console.log('idle false');
      }
    }
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
