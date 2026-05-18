import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@solidjs/testing-library';
import IdleController from '../src/components/features/IdleController';
import { MapContext, type MapContextValue } from '../src/components/map/MapContext';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  // @ts-ignore
  console.log.mockRestore();
  vi.useRealTimers();
});

function makeMapMock() {
  const listeners: Record<string, Function[]> = {};
  const map: any = {
    _listeners: listeners,
    on: (evt: string, cb: Function) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(cb);
    },
    off: (evt: string, cb: Function) => {
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter((f) => f !== cb);
    },
    _emit: (evt: string, ...args: any[]) => {
      (listeners[evt] || []).forEach((f) => f(...args));
    },
  };
  return map;
}

function renderWithMap(mapMock?: any) {
  const ctx: MapContextValue = {
    map: () => mapMock ?? null,
    flyToCity: vi.fn(),
    flyToCoords: vi.fn(),
    isIdle: () => false,
    stopIdle: vi.fn(),
    startIdle: vi.fn(),
  };

  return render(() => (
    <MapContext.Provider value={ctx}>
      <IdleController />
    </MapContext.Provider>
  ));
}

describe('IdleController — simplified behavior', () => {
  it('logs typing action and then user idle after timeout', async () => {
    // Add an input to the DOM
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'license-plate-input');
    document.body.appendChild(input);

    renderWithMap();

    // simulate typing
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(console.log).toHaveBeenCalledWith('action: typing');

    // advance time less than idle
    await vi.advanceTimersByTimeAsync(4000);
    expect(console.log).not.toHaveBeenCalledWith('user idle');

    // now advance past idle
    await vi.advanceTimersByTimeAsync(1500);
    expect(console.log).toHaveBeenCalledWith('user idle');

    // cleanup
    input.remove();
  });

  it('logs dragging action and then user idle after timeout', async () => {
    const mapMock = makeMapMock();
    renderWithMap(mapMock);

    // simulate dragstart
    mapMock._emit('dragstart');
    expect(console.log).toHaveBeenCalledWith('action: dragging');

    // simulate dragend
    mapMock._emit('dragend');

    // advance past idle
    await vi.advanceTimersByTimeAsync(5000);
    expect(console.log).toHaveBeenCalledWith('user idle');
  });

  it('multiple actions reset the idle timer', async () => {
    const mapMock = makeMapMock();
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'license-plate-input');
    document.body.appendChild(input);

    renderWithMap(mapMock);

    // typing
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(console.log).toHaveBeenCalledWith('action: typing');

    await vi.advanceTimersByTimeAsync(3000);

    // dragging happens before idle fires
    mapMock._emit('dragstart');
    expect(console.log).toHaveBeenCalledWith('action: dragging');

    // advance 5s from last action
    await vi.advanceTimersByTimeAsync(5000);
    expect(console.log).toHaveBeenCalledWith('user idle');

    input.remove();
  });
});
