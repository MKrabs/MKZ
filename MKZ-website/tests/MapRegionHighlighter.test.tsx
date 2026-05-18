import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { MapContext, type MapContextValue } from '../src/components/map/MapContext';

vi.mock('../src/data/region-outlines-low.json', () => ({
  default: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { ags: '09162', gen: 'München' }, geometry: { type: 'Polygon', coordinates: [[[11.58,48.13],[11.59,48.13],[11.59,48.14],[11.58,48.14]]] } },
      { type: 'Feature', properties: { ags: '11', gen: 'Berlin' }, geometry: { type: 'Polygon', coordinates: [[[13.4,52.5],[13.41,52.5],[13.41,52.51],[13.4,52.51]]] } },
    ]
  }
}));

function makeMapContext(): MapContextValue {
  const layers = new Set<string>();
  const sources = new Set<string>();

  const mapMock: any = {};
  mapMock.addSource = vi.fn((id: string) => { sources.add(id); });
  mapMock.addLayer = vi.fn((layer: any) => { layers.add(layer.id); });
  mapMock.getLayer = vi.fn((id: string) => layers.has(id) ? {} : undefined);
  mapMock.removeLayer = vi.fn((id: string) => { layers.delete(id); });
  mapMock.getSource = vi.fn((id: string) => sources.has(id) ? {} : undefined);
  mapMock.removeSource = vi.fn((id: string) => { sources.delete(id); });

  return {
    map: () => mapMock,
    flyToCity: vi.fn(),
    flyToCoords: vi.fn(),
    isIdle: () => false,
    stopIdle: vi.fn(),
    startIdle: vi.fn(),
  };
}

import MapRegionHighlighter from '../src/components/map/MapRegionHighlighter';

describe('MapRegionHighlighter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a GeoJSON source and layers when region prop is provided', () => {
    const region = { code: 'M', districtName: 'München', bundesland: 'Bayern', plateCount: 10, funFacts: ['x'] };

    const ctx = makeMapContext();
    render(() => <MapContext.Provider value={ctx}><MapRegionHighlighter region={region} /></MapContext.Provider>);

    expect(ctx.map().addSource).toHaveBeenCalled();
    expect(ctx.map().addLayer).toHaveBeenCalled();
  });

  it('removes previous highlight when region changes', () => {
    const regionA = { code: 'M', districtName: 'München', bundesland: 'Bayern', plateCount: 10, funFacts: ['x'] };
    const regionB = { code: 'B', districtName: 'Berlin', bundesland: 'Berlin', plateCount: 5, funFacts: ['y'] };

    const ctx = makeMapContext();
    render(() => <MapContext.Provider value={ctx}><MapRegionHighlighter region={regionA} /></MapContext.Provider>);

    // initial
    expect(ctx.map().addSource).toHaveBeenCalledTimes(1);
    expect(ctx.map().addLayer).toHaveBeenCalledTimes(2); // fill + outline

    // render again with same context and new region — same map instance
    render(() => <MapContext.Provider value={ctx}><MapRegionHighlighter region={regionB} /></MapContext.Provider>);

    // should have removed previous
    expect(ctx.map().removeLayer).toHaveBeenCalled();
    expect(ctx.map().removeSource).toHaveBeenCalled();
  });
});
