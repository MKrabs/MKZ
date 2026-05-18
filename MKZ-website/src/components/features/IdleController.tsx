import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { useMap } from '../map/MapContext';
import { extractPlatePrefix } from '~/data/plateRegions';

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
const BETWEEN_CODE_MS = 20000; // 20 seconds between codes
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

    if (!input || inputVal.trim() === '') {
      // idle and no input -> start typing random codes
      startTypingSequence();
    } else {
      // idle and input present -> cycle fun facts
      startFunFactCycle();
    }
  }

  // ---- Typing sequence ----
  function startTypingSequence() {
    if (isTypingSequence) return;
    isTypingSequence = true;
    const runNext = () => {
      if (!isIdle) return;
      const code = SAMPLE_CODES[Math.floor(Math.random() * SAMPLE_CODES.length)];
      typeIntoInput(code, () => {
        // after typing complete, wait BETWEEN_CODE_MS, then clear and type next
        betweenTimer = setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('[data-testid="license-plate-input"]');
          if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          runNext();
        }, BETWEEN_CODE_MS);
      });
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
      input.dispatchEvent(new Event('input', { bubbles: true }));
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
