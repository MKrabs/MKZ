import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

// ─── Mock maplibre-gl ──────────────────────────────────────────────────────

vi.mock('maplibre-gl', () => {
  type Handler = (...args: any[]) => void;

  const handlers: Record<string, Handler> = {};

  const instance = {
    _handlers: handlers,

    on: vi.fn((event: string, cb: Handler) => {
      handlers[event] = cb;
      return instance;
    }),

    flyTo: vi.fn(),
    easeTo: vi.fn(),
    stop: vi.fn(),
    remove: vi.fn(),

    touchZoomRotate: {
      disableRotation: vi.fn(),
    },
  };

  function MockMap(this: typeof instance) {
    Object.assign(this, instance);
  }

  return {
    default: {
      Map: MockMap,
      _mockInstance: instance,
    },
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import GlobeMap from '../src/components/map/GlobeMap';
import { useMap } from '~/components/map';

function makeMockStyle() {
  return {
    version: 8,
    name: 'Mock OpenFreeMap Liberty',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    layers: [],
  };
}

function mockStyleFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(makeMockStyle()),
    }),
  );
}

async function flushAsyncMapSetup() {
  // fetch()
  await Promise.resolve();

  // response.json()
  await Promise.resolve();

  // continuation after await
  await Promise.resolve();

  // Solid/reactive microtasks
  await Promise.resolve();
}

async function getMock() {
  const mod = (await import('maplibre-gl')).default as any;

  return mod._mockInstance as {
    _handlers: Record<string, (...args: any[]) => void>;
    on: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    touchZoomRotate: { disableRotation: ReturnType<typeof vi.fn> };
  };
}

async function triggerMapLoad() {
  await flushAsyncMapSetup();

  const m = await getMock();

  expect(m.on).toHaveBeenCalledWith('load', expect.any(Function));
  expect(typeof m._handlers.load).toBe('function');

  m._handlers.load();

  await Promise.resolve();

  return m;
}

beforeEach(() => {
  vi.useFakeTimers();
  mockStyleFetch();
});

afterEach(async () => {
  const m = await getMock();

  delete m._handlers.load;
  delete m._handlers.error;

  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Rendering ────────────────────────────────────────────────────────────

describe('GlobeMap — rendering', () => {
  it('renders the map container div', () => {
    render(() => <GlobeMap />);
    expect(screen.getByTestId('globe-map-container')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(() => (
      <GlobeMap>
        <div data-testid="child" />
      </GlobeMap>
    ));

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('container is fixed, z-index 0', () => {
    render(() => <GlobeMap />);

    const el = screen.getByTestId('globe-map-container');

    expect(el.style.position).toBe('fixed');
    expect(el.style.zIndex).toBe('0');
  });

  it('registers load event', async () => {
    render(() => <GlobeMap />);

    await flushAsyncMapSetup();

    const m = await getMock();

    expect(m.on).toHaveBeenCalledWith('load', expect.any(Function));
  });
});

// ─── Idle animation ───────────────────────────────────────────────────────

describe('GlobeMap — idle animation', () => {
  it('sets idle state to true after load', async () => {
    let isIdle!: () => boolean;

    const Consumer = () => {
      isIdle = useMap().isIdle;
      return <div />;
    };

    render(() => (
      <GlobeMap>
        <Consumer />
      </GlobeMap>
    ));

    await triggerMapLoad();

    expect(isIdle()).toBe(true);
  });

  it('disables touch rotation after load', async () => {
    render(() => <GlobeMap />);

    const m = await triggerMapLoad();

    expect(m.touchZoomRotate.disableRotation).toHaveBeenCalled();
  });
});

// ─── flyToCity ────────────────────────────────────────────────────────────

describe('GlobeMap — flyToCity', () => {
  async function setupAndLoad() {
    let flyToCity!: (key: string, offset?: [number, number]) => void;

    const Consumer = () => {
      flyToCity = useMap().flyToCity;
      return <div />;
    };

    render(() => (
      <GlobeMap>
        <Consumer />
      </GlobeMap>
    ));

    await triggerMapLoad();

    return flyToCity;
  }

  it('flies to Munich with correct coords', async () => {
    const flyToCity = await setupAndLoad();

    flyToCity('munich');

    const m = await getMock();

    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [11.582, 48.1351],
        zoom: 9,
        essential: true,
      }),
    );
  });

  it('flies to Berlin with correct coords', async () => {
    const flyToCity = await setupAndLoad();

    flyToCity('berlin');

    const m = await getMock();

    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [13.405, 52.52],
      }),
    );
  });

  it('flies to Karlsruhe with correct coords', async () => {
    const flyToCity = await setupAndLoad();

    flyToCity('karlsruhe');

    const m = await getMock();

    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [8.4037, 49.0069],
        zoom: 10,
      }),
    );
  });

  it('always uses bearing:0 and pitch:0', async () => {
    const flyToCity = await setupAndLoad();

    flyToCity('munich');

    const m = await getMock();

    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        bearing: 0,
        pitch: 0,
      }),
    );
  });

  it('passes pixel offset to flyTo', async () => {
    const flyToCity = await setupAndLoad();

    flyToCity('berlin', [150, -80]);

    const m = await getMock();

    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: [150, -80],
      }),
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

    const Consumer = () => {
      flyToCoords = useMap().flyToCoords;
      return <div />;
    };

    render(() => (
      <GlobeMap>
        <Consumer />
      </GlobeMap>
    ));

    await triggerMapLoad();

    flyToCoords([9.182, 48.776], 8, [100, -50]);

    const m = await getMock();

    expect(m.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [9.182, 48.776],
        zoom: 8,
        offset: [100, -50],
        bearing: 0,
      }),
    );
  });

  it('calls m.stop() to cancel idle pan before flying', async () => {
    const flyToCity = await setupAndLoad();

    flyToCity('munich');

    const m = await getMock();

    expect(m.stop).toHaveBeenCalled();
  });
});
