import { Component, onMount, onCleanup } from 'solid-js';
import { useMap } from '../map/MapContext';

/**
 * Simplified IdleController — listens for two actions:
 * - typing in the submission input (data-testid="license-plate-input")
 * - dragging the map (map 'dragstart'/'dragend')
 *
 * On action: console.log("action: <action>") where <action> is 'typing' or 'dragging'
 * If no action occurs for IDLE_MS milliseconds, log "user idle".
 */

const IDLE_MS = 5000;

const IdleController: Component = () => {
  const mapCtx = useMap();

  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function startIdleTimer() {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      console.log('user idle');
    }, IDLE_MS);
  }

  function onTyping() {
    console.log('action: typing');
    startIdleTimer();
  }

  function onDragging() {
    console.log('action: dragging');
    startIdleTimer();
  }

  onMount(() => {
    // Input typing listener
    const input = document.querySelector('[data-testid="license-plate-input"]');
    if (input) input.addEventListener('input', onTyping as EventListener);

    // Map dragging listeners
    const m = mapCtx.map();
    const handlers: Array<{ event: string; cb: any }> = [];
    if (m && typeof m.on === 'function') {
      const dragStartCb = () => onDragging();
      const dragEndCb = () => startIdleTimer();
      m.on('dragstart', dragStartCb);
      m.on('dragend', dragEndCb);
      handlers.push({ event: 'dragstart', cb: dragStartCb }, { event: 'dragend', cb: dragEndCb });
    }

    // Start timer initially
    startIdleTimer();

    onCleanup(() => {
      // remove input listener
      if (input) input.removeEventListener('input', onTyping as EventListener);
      // remove map listeners
      if (m && typeof m.off === 'function') {
        handlers.forEach(h => m.off(h.event, h.cb));
      }
      clearIdleTimer();
    });
  });

  return null;
};

export default IdleController;
