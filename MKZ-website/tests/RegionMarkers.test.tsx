/**
 * RegionMarkers — renders plate-sign markers on the map for today's plates.
 *
 * Tests:
 * - Fetches today's plates on mount and creates markers
 * - Each marker shows the plate prefix code
 * - Markers have a "sign with stick" appearance (via CSS classes/structure)
 * - Clicking a marker pans the map to the region
 * - Hover raises and enlarges the marker
 * - Adding a new plate via addPlateMarker inserts it reactively
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { MapContext, type MapContextValue } from '~/components/map';

// ─── PB mock ────────────────────────────────────────────────────────────────
const _colMocks: Record<string, any> = {};
function col(name: string) {
  if (!_colMocks[name]) {
    _colMocks[name] = {
      getFirstListItem: vi.fn(),
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

// ─── Mock maplibre-gl ──────────────────────────────────────────────────────
const mockMarkers: any[] = [];
const mockMarkerInstance = {
  setLngLat: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  remove: vi.fn(),
  getElement: vi.fn(() => document.createElement('div')),
};

vi.mock('maplibre-gl', () => {
  class MockMarker {
    _element: HTMLElement;
    constructor(opts?: any) {
      this._element = opts?.element || document.createElement('div');
      mockMarkers.push(this);
    }
    setLngLat = vi.fn().mockReturnThis();
    addTo = vi.fn().mockReturnThis();
    remove = vi.fn();
    getElement() { return this._element; }
  }

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
    default: { Map: MockMap, Marker: MockMarker, _mockInstance: instance },
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

import RegionMarkers from '../src/components/map/RegionMarkers';
import { RegionMarkersContext, type RegionMarkersContextValue } from '~/components/map';

// ─── Map context helper ──────────────────────────────────────────────────────
const mockFlyToCoords = vi.fn();

function makeMapContext(): MapContextValue {
  return {
    map: () => ({ fake: true } as any), // non-null = map loaded
    flyToCity: vi.fn(),
    flyToCoords: mockFlyToCoords,
    isIdle: () => false,
    stopIdle: vi.fn(),
    startIdle: vi.fn(),
  };
}

function renderMarkers() {
  let ctxValue!: RegionMarkersContextValue;
  const Capture = () => {
    // We'll get context from the provider inside RegionMarkers
    return null;
  };
  const { container } = render(() => (
    <MapContext.Provider value={makeMapContext()}>
      <RegionMarkers />
    </MapContext.Provider>
  ));
  return { container };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegionMarkers — rendering today\'s plates', () => {
  beforeEach(() => {
    mockMarkers.length = 0;
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    mockFlyToCoords.mockClear();
  });

  it('fetches today\'s plates on mount and creates markers', async () => {
    col('seen_plates').getList.mockResolvedValueOnce({
      items: [
        { id: '1', plate_text: 'M AB 123', kennzeichen: 'kz1', user: 'u1', image: '', noted_at: new Date().toISOString() },
        { id: '2', plate_text: 'B CD 456', kennzeichen: 'kz2', user: 'u2', image: '', noted_at: new Date().toISOString() },
      ],
    });
    // Kennzeichen lookups for coordinates
    col('kennzeichen').getFirstListItem
      .mockResolvedValueOnce({ code: 'M', district_name: 'München', bundesland_iso: 'DE-BY', bundesland: 'Bayern', active: true })
      .mockResolvedValueOnce({ code: 'B', district_name: 'Berlin', bundesland_iso: 'DE-BE', bundesland: 'Berlin', active: true });

    renderMarkers();

    await waitFor(() => {
      const markers = screen.getAllByTestId('region-marker');
      expect(markers.length).toBe(2);
    }, { timeout: 2000 });
  });

  it('each marker shows the plate prefix code', async () => {
    col('seen_plates').getList.mockResolvedValueOnce({
      items: [
        { id: '1', plate_text: 'KA NR 355', kennzeichen: 'kz1', user: 'u1', image: '', noted_at: new Date().toISOString() },
      ],
    });
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      code: 'KA', district_name: 'Karlsruhe', bundesland_iso: 'DE-BW', bundesland: 'Baden-Württemberg', active: true,
    });

    renderMarkers();

    await waitFor(() => {
      expect(screen.getByText('KA')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('marker has sign-with-stick structure', async () => {
    col('seen_plates').getList.mockResolvedValueOnce({
      items: [
        { id: '1', plate_text: 'M AB 123', kennzeichen: 'kz1', user: 'u1', image: '', noted_at: new Date().toISOString() },
      ],
    });
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      code: 'M', district_name: 'München', bundesland_iso: 'DE-BY', bundesland: 'Bayern', active: true,
    });

    renderMarkers();

    await waitFor(() => {
      const marker = screen.getByTestId('region-marker');
      // Should have a stick element
      expect(marker.querySelector('[data-testid="marker-stick"]')).toBeInTheDocument();
      // Should have a plate element
      expect(marker.querySelector('[data-testid="marker-plate"]')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('clicking a marker calls flyToCoords for that region', async () => {
    col('seen_plates').getList.mockResolvedValueOnce({
      items: [
        { id: '1', plate_text: 'M AB 123', kennzeichen: 'kz1', user: 'u1', image: '', noted_at: new Date().toISOString() },
      ],
    });
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      code: 'M', district_name: 'München', bundesland_iso: 'DE-BY', bundesland: 'Bayern', active: true,
    });

    renderMarkers();

    await waitFor(() => {
      expect(screen.getByTestId('region-marker')).toBeInTheDocument();
    }, { timeout: 2000 });

    fireEvent.click(screen.getByTestId('region-marker'));
    expect(mockFlyToCoords).toHaveBeenCalledWith([11.582, 48.135], expect.any(Number), undefined);
  });

  it('hovering a marker adds the raised class', async () => {
    col('seen_plates').getList.mockResolvedValueOnce({
      items: [
        { id: '1', plate_text: 'M AB 123', kennzeichen: 'kz1', user: 'u1', image: '', noted_at: new Date().toISOString() },
      ],
    });
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      code: 'M', district_name: 'München', bundesland_iso: 'DE-BY', bundesland: 'Bayern', active: true,
    });

    renderMarkers();

    await waitFor(() => {
      expect(screen.getByTestId('region-marker')).toBeInTheDocument();
    }, { timeout: 2000 });

    const marker = screen.getByTestId('region-marker');
    fireEvent.mouseEnter(marker);
    expect(marker.classList.contains('marker-raised')).toBe(true);

    fireEvent.mouseLeave(marker);
    expect(marker.classList.contains('marker-raised')).toBe(false);
  });

  it('renders no markers when no plates found today', async () => {
    col('seen_plates').getList.mockResolvedValueOnce({ items: [] });

    renderMarkers();

    // Wait a bit to ensure nothing renders
    await new Promise((r) => setTimeout(r, 500));
    expect(screen.queryByTestId('region-marker')).toBeNull();
  });
});
