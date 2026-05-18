import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { useMap } from '../map/MapContext';
import { user } from '~/store/auth';

/**
 * IdleController:
 * - When idle and input empty: types a random plate code into the submission input
 *   character-by-character with native caret visible. Waits 20s between codes.
 * - When idle and input non-empty: cycles fun facts shown in the DOM element
 *   data-testid="fun-fact" (placeholder facts used when none exist).
 *
 * User interactions (typing) interrupt the idle behavior.
 */

const IDLE_MS = 5000;
const BETWEEN_CODE_MS = 5000; // 20 seconds between codes
const TYPING_INTERVAL = 180; // ms per char

const SAMPLE_CODES = ['M', 'B', 'KA', 'F', 'K', 'D', 'S'];
const PLACEHOLDER_FUNFACTS = [
  'Did you know? This region loves pretzels.',
  'Fun fact: Famous landmark here.',
  'Trivia: Local specialty is delicious.'
];

const IdleController: Component = () => {
  const mapCtx = useMap();

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let betweenTimer: ReturnType<typeof setTimeout> | null = null;
  let funFactInterval: ReturnType<typeof setInterval> | null = null;

  let isIdle = false;
  let isTypingSequence = false;

  function clearAllTimers() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
    if (betweenTimer) { clearTimeout(betweenTimer); betweenTimer = null; }
    if (funFactInterval) { clearInterval(funFactInterval); funFactInterval = null; }
  }

  function scheduleIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => startIdle(), IDLE_MS);
  }

  function cancelIdle() {
    isIdle = false;
    clearAllTimers();
    stopTypingSequence();
    stopFunFactCycle();
  }

  function onUserAction(action: 'typing') {
    console.log(`action: ${action}`);
    // any action resets idle
    cancelIdle();
    scheduleIdle();
  }


  function startIdle() {
    isIdle = true;
    // announce idle
    console.log('user idle');

    const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
    const inputVal = input?.value ?? '';

    // Only run the automated demo when NOT logged in
    if (user() == null && (!input || inputVal.trim() === '')) {
      // idle, not logged in, and input empty -> start automated city demo
      startTypingSequence();
    } else if (!input || inputVal.trim() === '') {
      // input empty but user logged in — do nothing (or could implement other behavior)
    } else {
      // idle and input present -> cycle fun facts
      startFunFactCycle();
    }
  }

  // ---- Typing sequence ----
  function startTypingSequence() {
    if (isTypingSequence) return;
    isTypingSequence = true;
    const runNext = async () => {
      if (!isIdle) return;
      // pick a random city name from SAMPLE_CODES (these are placeholders)
      const city = SAMPLE_CODES[Math.floor(Math.random() * SAMPLE_CODES.length)];

      // Programmatically set the input but mark it as programmatic so our input listener ignores it
      const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
      if (input) {
        input.dataset.mkzProgrammatic = '1';
      }

      await new Promise<void>((res) => {
        typeIntoInput(city, () => res());
      });

      // remove programmatic marker after a short delay
      if (input) {
        setTimeout(() => delete input.dataset.mkzProgrammatic, 50);
      }

      // Wait 5 seconds before zooming out and panning
      await new Promise((r) => setTimeout(r, 5000));

      if (!isIdle) return;

      // Zoom out to Germany view and pan aimlessly a bit
      mapCtx.flyToCoords([10.0, 51.0], 5);
      // slight random pan
      const dx = (Math.random() - 0.5) * 2; // -1..1
      const dy = (Math.random() - 0.5) * 2;
      mapCtx.flyToCoords([10.0 + dx, 51.0 + dy], 5);

      // After panning, wait a moment and clear input (without firing input event)
      await new Promise((r) => setTimeout(r, 800));
      if (input) {
        input.value = '';
      }

      // wait BETWEEN_CODE_MS then repeat
      betweenTimer = setTimeout(() => {
        if (isIdle) runNext();
      }, BETWEEN_CODE_MS);
    };

    runNext();
  }

  function stopTypingSequence() {
    isTypingSequence = false;
    if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
    if (betweenTimer) { clearTimeout(betweenTimer); betweenTimer = null; }
  }

  function typeIntoInput(code: string, onComplete?: () => void) {
    const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
    if (!input) { onComplete?.(); return; }

    // focus input to show native caret
    input.focus();

    let idx = 0;
    const step = () => {
      if (!isIdle) { onComplete?.(); return; }
      idx++;
      input.value = code.slice(0, idx);
      // Only dispatch input event if this is not marked programmatic (tests will simulate user by dispatching events themselves)
      const isProgrammatic = input.dataset.mkzProgrammatic === '1';
      if (!isProgrammatic) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (idx < code.length) {
        typingTimer = setTimeout(step, TYPING_INTERVAL);
      } else {
        // done typing
        input.setSelectionRange(input.value.length, input.value.length);
        onComplete?.();
      }
    };

    step();
  }

  // ---- Fun fact cycle ----
  function startFunFactCycle() {
    // find fun fact container
    const funEl = document.querySelector<HTMLElement>('[data-testid="fun-fact"]');
    if (!funEl) return;

    // placeholder facts or preserve current
    const facts = PLACEHOLDER_FUNFACTS.slice();
    let idx = 0;
    funEl.textContent = facts[idx];

    funFactInterval = setInterval(() => {
      if (!isIdle) return;
      idx = (idx + 1) % facts.length;
      funEl.textContent = facts[idx];
    }, 5000);
  }

  function stopFunFactCycle() {
    if (funFactInterval) { clearInterval(funFactInterval); funFactInterval = null; }
  }

  let inputEl: HTMLElement | null = null;

  onMount(() => {
    // Attach typing listener
    inputEl = document.querySelector('[data-testid="license-plate-input"]');
    const onInput = () => onUserAction('typing');
    if (inputEl) inputEl.addEventListener('input', onInput as EventListener);

    // initial schedule
    scheduleIdle();

    onCleanup(() => {
      if (inputEl) inputEl.removeEventListener('input', onInput as EventListener);
      clearAllTimers();
    });
  });

  // React to map idle state from MapContext
  createEffect(() => mapCtx.isIdle() ? scheduleIdle() : cancelIdle());

  return null;
};

export default IdleController;
