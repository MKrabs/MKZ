import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { useMap } from '~/components/map';
import REGION_LOW from '~/data/region-outlines-low.json';

/**
 * IdleController — placeholder animation across many cities.
 *
 * Sequence per city:
 * - Start at default '<city code>' placeholder (PlateSubmission sets this)
 * - Delete default one char at a time to empty
 * - Type first 1..2 chars of city name (uppercase) one char at a time
 *   wait briefly, then delete back to empty
 * - Type '<', '<c', '<ci', '<cit', '<city' progressively
 * - Wait, zoom out and pan a bit, restore placeholder, move to next city
 *
 * Only runs when map is idle and input value is empty; user typing cancels it.
 */

const IDLE_MS = 5000;
const BETWEEN_MS = 5000; // wait after typing before zoom/pan
const CHAR_INTERVAL = 200;
const CITY_COUNT = 20;

function pickRandomCities(n: number) {
  const names: string[] = (REGION_LOW as any).features.map((f: any) => f.properties?.gen).filter(Boolean);
  // shuffle
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, Math.min(n, names.length));
}

const IdleController: Component = () => {
  const mapCtx = useMap();

  const cities = pickRandomCities(CITY_COUNT);

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
      idleTimer = setTimeout(() => {
        idle = true;
        console.log('user idle');
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

  async function animateDeletion(input: HTMLInputElement, text: string) {
    for (let i = text.length; i >= 0 && idle; i--) {
      input.setAttribute('placeholder', text.slice(0, i));
      await new Promise((r) => (idle ? setTimeout(r, CHAR_INTERVAL) : r()));
    }
  }

  async function animateTyping(input: HTMLInputElement, text: string) {
    for (let i = 1; i <= text.length && idle; i++) {
      input.setAttribute('placeholder', text.slice(0, i));
      await new Promise((r) => (idle ? setTimeout(r, CHAR_INTERVAL) : r()));
    }
  }

  async function startIdleSequence() {
    if (runningSequence) return;
    runningSequence = true;

    const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
    if (!input) { runningSequence = false; return; }

    const originalPlaceholder = input.getAttribute('placeholder') ?? '<city code>';

    for (const city of cities) {
      if (!idle) break;

      const name = (city || '').trim();
      const upName = name.toUpperCase();

      // 1) Delete default to empty
      await animateDeletion(input, originalPlaceholder);
      if (!idle) break;

      // 2) Type first 1..2 chars of city name
      const two = upName.slice(0, 2);
      await animateTyping(input, two);
      if (!idle) break;

      // wait briefly, then delete to 1 then to empty
      await new Promise((r) => (idle ? setTimeout(r, 500) : r()));
      await animateDeletion(input, two.slice(0, 1));
      if (!idle) break;
      await animateDeletion(input, '');
      if (!idle) break;

      // 3) Type '<', '<C', '<CI', ... up to a few chars
      const maxChars = Math.min(5, upName.length);
      for (let i = 0; i <= maxChars && idle; i++) {
        const txt = '<' + upName.slice(0, i);
        input.setAttribute('placeholder', txt);
        await new Promise((r) => (idle ? setTimeout(r, CHAR_INTERVAL) : r()));
      }
      if (!idle) break;

      // 4) Wait, zoom out and pan slightly
      await new Promise((r) => (idle ? setTimeout(r, BETWEEN_MS) : r()));
      if (!idle) break;
      try {
        mapCtx.flyToCoords([10.0, 51.0], 5);
        const dx = (Math.random() - 0.5) * 2;
        const dy = (Math.random() - 0.5) * 2;
        mapCtx.flyToCoords([10.0 + dx, 51.0 + dy], 5);
      } catch (e) {
        // ignore
      }

      // restore placeholder
      input.setAttribute('placeholder', originalPlaceholder);

      // small pause
      await new Promise((r) => (idle ? setTimeout(r, 1000) : r()));
    }

    runningSequence = false;
  }

  function stopIdleSequence() {
    runningSequence = false;
  }

  onMount(() => {
    const input = document.querySelector('[data-testid="license-plate-input"]');
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      // ignore programmatic changes if flagged
      if (t?.dataset?.mkzProgrammatic === '1') return;

      console.log('action: typing');
      clearIdleTimer();
      if (idle) {
        idle = false;
        console.log('idle false');
      }
      evaluateIdle();
    };

    if (input) input.addEventListener('input', onInput as EventListener);
    document.addEventListener('input', onInput as EventListener);

    evaluateIdle();

    onCleanup(() => {
      if (input) input.removeEventListener('input', onInput as EventListener);
      document.removeEventListener('input', onInput as EventListener);
      clearIdleTimer();
    });
  });

  createEffect(() => {
    mapCtx.isIdle();
    evaluateIdle();
  });

  return null;
};

export default IdleController;
