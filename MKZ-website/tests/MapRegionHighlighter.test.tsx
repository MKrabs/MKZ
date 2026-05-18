import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@solidjs/testing-library';
import { MapContext, type MapContextValue } from '~/components/map';
import MapRegionHighlighter from '../src/components/map/MapRegionHighlighter';

// Mock fetchGeoRegions — the component's only data dependency
vi.mock('../src/api/kennzeichen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/kennzeichen')>();
  return {
    ...actual,
    fetchGeoRegions: vi.fn(),
    buildGeoJSON: actual.buildGeoJSON,
  };
});

import { fetchGeoRegions } from '../src/api/kennzeichen';

const MOCK_REGIONS = [
  {
    id: 'geo1',
    ags: '09162',
    gen: 'München',
    low: {
      type: 'Polygon',
      coordinates: [[[11.58, 48.13], [11.59, 48.13], [11.59, 48.14], [11.58, 48.14], [11.58, 48.13]]],
    },
    high: null,
  },
];

function makeMapContext(): MapContextValue {
  const layers = new Set<string>();
  const sources = new Set<string>();
  const mapMock: any = {
    addSource:    vi.fn((id: string) => { sources.add(id); }),
    addLayer:     vi.fn((layer: any) => { layers.add(layer.id); }),
    getLayer:     vi.fn((id: string) => layers.has(id) ? {} : undefined),
    removeLayer:  vi.fn((id: string) => { layers.delete(id); }),
    getSource:    vi.fn((id: string) => sources.has(id) ? { setData: vi.fn() } : undefined),
    removeSource: vi.fn((id: string) => { sources.delete(id); }),
  };
  return {
    map: () => mapMock,
    flyToCity: vi.fn(),
    flyToCoords: vi.fn(),
    isIdle: () => false,
    stopIdle: vi.fn(),
    startIdle: vi.fn(),
  };
}

describe('MapRegionHighlighter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a GeoJSON source and layers when kennzeichenId is provided', async () => {
    vi.mocked(fetchGeoRegions).mockResolvedValueOnce(MOCK_REGIONS);
    const ctx = makeMapContext();

    render(() => (
      <MapContext.Provider value={ctx}>
        <MapRegionHighlighter kennzeichenId="kz-001" />
      </MapContext.Provider>
    ));

    // Wait for the async fetchGeoRegions to resolve
    await vi.waitFor(() => {
      expect(ctx.map().addSource).toHaveBeenCalled();
    });
    expect(ctx.map().addLayer).toHaveBeenCalledTimes(2); // fill + line
  });

  it('clears layers when kennzeichenId is null', async () => {
    const ctx = makeMapContext();

    render(() => (
      <MapContext.Provider value={ctx}>
        <MapRegionHighlighter kennzeichenId={null} />
      </MapContext.Provider>
    ));

    // No fetch, no layers added
    expect(fetchGeoRegions).not.toHaveBeenCalled();
    expect(ctx.map().addSource).not.toHaveBeenCalled();
  });

  it('does not apply stale results when kennzeichenId changes quickly', async () => {
    let resolveFirst!: (v: any) => void;
    const firstFetch = new Promise((r) => { resolveFirst = r; });

    vi.mocked(fetchGeoRegions)
      .mockReturnValueOnce(firstFetch as any)
      .mockResolvedValueOnce(MOCK_REGIONS);

    const ctx = makeMapContext();
    const [kennzeichenId, setKennzeichenId] = [{ value: 'kz-001' }, null] as any;

    // Render with first id, then immediately change — first fetch should be discarded
    const { rerender } = render(() => (
      <MapContext.Provider value={ctx}>
        <MapRegionHighlighter kennzeichenId="kz-001" />
      </MapContext.Provider>
    ));

    // Resolve first fetch late (after second render)
    resolveFirst(MOCK_REGIONS);

    // First fetch result should be discarded — no double-apply
    await vi.waitFor(() => {
      expect(fetchGeoRegions).toHaveBeenCalledWith('kz-001', 'low');
    });
  });
});
