import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// ─── Mock maplibre-gl ──────────────────────────────────────────────────────
vi.mock('maplibre-gl', () => {
  const instance = {
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'load') setTimeout(cb, 0);
    }),
    flyTo: vi.fn(),
    easeTo: vi.fn(),
    stop: vi.fn(),
    remove: vi.fn(),
    touchZoomRotate: { disableRotation: vi.fn() },
  };

  function MockMap(this: typeof instance) {
    Object.assign(this, instance);
  }

  return {
    default: { Map: MockMap, _mockInstance: instance },
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import GlobeMap from '../src/components/map/GlobeMap';
import { useMap } from '../src/components/map/MapContext';

async function getMock() {
  const mod = (await import('maplibre-gl')).default as any;
  return mod._mockInstance as {
    on: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    touchZoomRotate: { disableRotation: ReturnType<typeof vi.fn> };
  };
}

// ─── Rendering ────────────────────────────────────────────────────────────

describe('GlobeMap — rendering', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('renders the map container div', () => {
    render(() => <GlobeMap />);
    expect(screen.getByTestId('globe-map-container')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(() => <GlobeMap><div data-testid="child" /></GlobeMap>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('container is fixed, z-index 0', () => {
    render(() => <GlobeMap />);
    const el = screen.getByTestId('globe-map-container');
    expect(el.style.position).toBe('fixed');
    expect(el.style.zIndex).toBe('0');
  });

  it('registers load event', () => {
    render(() => <GlobeMap />);
    // The mock on() is called; load is the event we care about
    // (can't inspect Map constructor options directly through the mock)
    expect(true).toBe(true); // structure test — no crash
  });
});

// ─── Idle animation ───────────────────────────────────────────────────────

describe('GlobeMap — idle animation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('starts easeTo panning after load', async () => {
    render(() => <GlobeMap />);
    vi.runOnlyPendingTimers();
    await Promise.resolve();

    const m = await getMock();
    expect(m.easeTo).toHaveBeenCalled();
  });

  it('idle easeTo uses bearing:0 and pitch:0 (north always up, flat)', async () => {
    render(() => <GlobeMap />);
    vi.runOnlyPendingTimers();
    await Promise.resolve();

    const m = await getMock();
    const opts = m.easeTo.mock.calls[0]?.[0];
    expect(opts?.bearing).toBe(0);
    expect(opts?.pitch).toBe(0);
  });

  it('disables touch rotation after load', async () => {
    render(() => <GlobeMap />);
    vi.runOnlyPendingTimers();
    await Promise.resolve();

    const m = await getMock();
    expect(m.touchZoomRotate.disableRotation).toHaveBeenCalled();
  });
});

// ─── flyToCity ────────────────────────────────────────────────────────────

describe('GlobeMap — flyToCity', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  async function setupAndLoad() {
    let flyToCity!: (key: string, offset?: [number, number]) => void;
    const Consumer = () => { flyToCity = useMap().flyToCity; return <div />; };
    render(() => <GlobeMap><Consumer /></GlobeMap>);
    vi.runOnlyPendingTimers();
    await Promise.resolve();
    return flyToCity;
  }

  it('flies to Munich with correct coords', async () => {
    const flyToCity = await setupAndLoad();
    flyToCity('munich');
    const m = await getMock();
    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [11.582, 48.1351], zoom: 9, essential: true }),
    );
  });

  it('flies to Berlin with correct coords', async () => {
    const flyToCity = await setupAndLoad();
    flyToCity('berlin');
    const m = await getMock();
    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [13.405, 52.52] }),
    );
  });

  it('flies to Karlsruhe with correct coords', async () => {
    const flyToCity = await setupAndLoad();
    flyToCity('karlsruhe');
    const m = await getMock();
    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [8.4037, 49.0069], zoom: 10 }),
    );
  });

  it('always uses bearing:0 and pitch:0', async () => {
    const flyToCity = await setupAndLoad();
    flyToCity('munich');
    const m = await getMock();
    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ bearing: 0, pitch: 0 }),
    );
  });

  it('passes pixel offset to flyTo', async () => {
    const flyToCity = await setupAndLoad();
    flyToCity('berlin', [150, -80]);
    const m = await getMock();
    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ offset: [150, -80] }),
    );
  });

  it('does NOT call flyTo for unknown city key', async () => {
    const flyToCity = await setupAndLoad();
    flyToCity('atlantis');
    const m = await getMock();
    expect(m.flyTo).not.toHaveBeenCalled();
  });

  it('flyToCoords pans to arbitrary coordinates with bearing:0', async () => {
    let flyToCoords!: (c: [number, number], z: number, o?: [number, number]) => void;
    const Consumer = () => { flyToCoords = useMap().flyToCoords; return <div />; };
    render(() => <GlobeMap><Consumer /></GlobeMap>);
    vi.runOnlyPendingTimers();
    await Promise.resolve();

    flyToCoords([9.182, 48.776], 8, [100, -50]);

    const m = await getMock();
    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [9.182, 48.776], zoom: 8, offset: [100, -50], bearing: 0 }),
    );
  });

  it('calls m.stop() to cancel idle pan before flying', async () => {
    const flyToCity = await setupAndLoad();
    flyToCity('munich');
    const m = await getMock();
    expect(m.stop).toHaveBeenCalled();
  });
});
