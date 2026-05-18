/**
 * IdleController — manages idle states and animations.
 *
 * Three idle tiers:
 * 1. Not-logged-in: types city names in placeholder, pans map, shows details
 * 2. Logged-in no-input: same but uses user's recent plates
 * 3. Logged-in with-input: cycles fun facts about the current region
 *
 * Idle starts only when:
 * - All conditions are met (no recent interaction)
 * - A timeout has elapsed since last interaction
 *
 * Interactions that reset idle:
 * - User logs in
 * - User inputs a plate
 * - User drags the map
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

// ─── Mocks ────────────────────────────────────────────────────────────────────
const _colMocks: Record<string, any> = {};
function col(name: string) {
  if (!_colMocks[name]) {
    _colMocks[name] = {
      getFirstListItem: vi.fn().mockRejectedValue(new Error('nf')),
      getList: vi.fn().mockResolvedValue({ items: [] }),
      create: vi.fn(),
      delete: vi.fn(),
    };
  }
  return _colMocks[name];
}

vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn((name: string) => col(name)),
    authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() },
    autoCancellation: vi.fn(),
  },
}));

let mockUser: any = null;
vi.mock('../src/store/auth', () => ({
  get user() { return () => mockUser; },
  setUser: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(),
}));

import IdleController, { IDLE_TIMEOUT, TYPING_INTERVAL } from '../src/components/features/IdleController';
import { MapContext, type MapContextValue } from '~/components/map';

const mockFlyToCoords = vi.fn();
const mockStopIdle = vi.fn();
const mockStartIdle = vi.fn();

function makeMapContext(): MapContextValue {
  return {
    map: () => ({ fake: true } as any),
    flyToCity: vi.fn(),
    flyToCoords: mockFlyToCoords,
    isIdle: () => false,
    stopIdle: mockStopIdle,
    startIdle: mockStartIdle,
  };
}

function renderIdle() {
  return render(() => (
    <MapContext.Provider value={makeMapContext()}>
      <IdleController />
    </MapContext.Provider>
  ));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IdleController — not logged in idle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUser = null;
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    mockFlyToCoords.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('renders the idle placeholder container', () => {
    renderIdle();
    expect(screen.getByTestId('idle-controller')).toBeInTheDocument();
  });

  it('starts typing animation after IDLE_TIMEOUT when not logged in', async () => {
    renderIdle();

    // Before timeout: no typing happening
    expect(screen.queryByTestId('idle-typing-text')).toBeNull();

    // Advance past idle timeout
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT + 100);

    expect(screen.getByTestId('idle-typing-text')).toBeInTheDocument();
  });

  it('typing animation shows characters one by one', async () => {
    renderIdle();
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT + 100);

    const typingEl = screen.getByTestId('idle-typing-text');
    const initial = typingEl.textContent?.length ?? 0;

    // Advance one typing interval
    await vi.advanceTimersByTimeAsync(TYPING_INTERVAL);
    const after = typingEl.textContent?.length ?? 0;
    expect(after).toBeGreaterThan(initial);
  });

  it('pans map after typing a complete city name', async () => {
    renderIdle();
    // Advance enough time to type a full city name (assume ~10 chars max * interval + pause)
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT + 15 * TYPING_INTERVAL + 1000);

    expect(mockFlyToCoords).toHaveBeenCalled();
  });

  it('resets idle on user interaction (interaction signal)', async () => {
    renderIdle();
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT + 100);
    expect(screen.getByTestId('idle-typing-text')).toBeInTheDocument();

    // Simulate interaction via the interaction reset
    fireEvent.click(screen.getByTestId('idle-controller'));

    // Should reset — typing goes away, restart timer
    await vi.advanceTimersByTimeAsync(100);
    expect(screen.queryByTestId('idle-typing-text')).toBeNull();
  });
});

describe('IdleController — logged in no-input idle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUser = { id: 'user1', name: 'Max' };
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    col('seen_plates').getList.mockResolvedValue({
      items: [
        { id: '1', plate_text: 'M AB 123', kennzeichen: 'kz1', user: 'user1', noted_at: new Date().toISOString() },
        { id: '2', plate_text: 'B CD 456', kennzeichen: 'kz2', user: 'user1', noted_at: new Date().toISOString() },
      ],
    });
    mockFlyToCoords.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('uses recent plates for typing when logged in', async () => {
    renderIdle();
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT + 100);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Should be typing one of the user's plates
    const typingEl = screen.getByTestId('idle-typing-text');
    expect(typingEl).toBeInTheDocument();
  });
});

describe('IdleController — logged in with input idle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUser = { id: 'user1', name: 'Max' };
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    mockFlyToCoords.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('shows fun fact cycling when activeRegion is set', async () => {
    render(() => (
      <MapContext.Provider value={makeMapContext()}>
        <IdleController
          activeRegion={{
            code: 'M',
            districtName: 'München',
            bundesland: 'Bayern',
            plateCount: 42,
            funFacts: ['Fact A.', 'Fact B.'],
          }}
        />
      </MapContext.Provider>
    ));

    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT + 100);

    expect(screen.getByTestId('idle-fun-fact')).toBeInTheDocument();
  });
});
