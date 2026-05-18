import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';
import { MapContext, type MapContextValue } from '../src/components/map/MapContext';

vi.mock('../src/data/region-outlines-low.json', () => ({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { ags: '09162', gen: 'München' }, geometry: { type: 'Polygon', coordinates: [[[11.58,48.13],[11.59,48.13],[11.59,48.14],[11.58,48.14]]] } },
    { type: 'Feature', properties: { ags: '11', gen: 'Berlin' }, geometry: { type: 'Polygon', coordinates: [[[13.4,52.5],[13.41,52.5],[13.41,52.51],[13.4,52.51]]] } },
  ]
}));

const mockAddSource = vi.fn();
const mockRemoveSource = vi.fn();
const mockAddLayer = vi.fn();
const mockRemoveLayer = vi.fn();

function makeMapContext(): MapContextValue {
  return {
    map: () => ({ addSource: mockAddSource, removeSource: mockRemoveSource, addLayer: mockAddLayer, removeLayer: mockRemoveLayer } as any),
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

    render(() => <MapContext.Provider value={makeMapContext()}><MapRegionHighlighter region={region} /></MapContext.Provider>);

    expect(mockAddSource).toHaveBeenCalled();
    expect(mockAddLayer).toHaveBeenCalled();
  });

  it('removes previous highlight when region changes', () => {
    const regionA = { code: 'M', districtName: 'München', bundesland: 'Bayern', plateCount: 10, funFacts: ['x'] };
    const regionB = { code: 'B', districtName: 'Berlin', bundesland: 'Berlin', plateCount: 5, funFacts: ['y'] };

    render(() => <MapContext.Provider value={makeMapContext()}><MapRegionHighlighter region={regionA} /></MapContext.Provider>);

    // initial
    expect(mockAddSource).toHaveBeenCalledTimes(1);
    expect(mockAddLayer).toHaveBeenCalledTimes(2); // fill + outline

    // render new region (second mount) — should remove previous highlight
    render(() => <MapContext.Provider value={makeMapContext()}><MapRegionHighlighter region={regionB} /></MapContext.Provider>);

    // should have removed previous
    expect(mockRemoveLayer).toHaveBeenCalled();
    expect(mockRemoveSource).toHaveBeenCalled();
  });
});
