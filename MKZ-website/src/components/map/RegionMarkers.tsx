/**
 * RegionMarkers — renders small plate-sign markers on the map
 * for all plates found today.
 *
 * Each marker looks like a little sign on a stick showing the plate prefix.
 * - Hover: marker raises up and grows slightly
 * - Click: map pans to the region
 * - Markers are positioned using the map's project() to follow panning/zoom
 */
import { Component, For, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { useMap } from './MapContext';
import { RegionMarkersContext, type PlateMarkerData, type RegionMarkersContextValue } from './RegionMarkersContext';
import { extractPlatePrefix } from '../../data/plateRegions';
import { BUNDESLAND_COORDS, BUNDESLAND_ZOOM } from '../../data/bundeslandCoords';
import pb from '../../lib/pb';

// ─── Fetch today's plates ─────────────────────────────────────────────────────

async function fetchTodayPlates(): Promise<PlateMarkerData[]> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];

  const result = await pb.collection('seen_plates').getList(1, 200, {
    filter: `noted_at >= "${dateStr} 00:00:00"`,
    sort: '-noted_at',
  });

  const markers: PlateMarkerData[] = [];

  for (const item of result.items) {
    const code = extractPlatePrefix(item.plate_text);
    if (!code) continue;

    try {
      const kz = await pb.collection('kennzeichen').getFirstListItem(`code = "${code}"`);
      const coords = BUNDESLAND_COORDS[kz.bundesland_iso];
      if (coords) {
        markers.push({
          id: item.id,
          code,
          coords,
          districtName: kz.district_name,
          bundeslandIso: kz.bundesland_iso,
        });
      }
    } catch {
      // Unknown code, skip
    }
  }

  return markers;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RegionMarkers: Component = () => {
  const [markers, setMarkers] = createSignal<PlateMarkerData[]>([]);
  const [hoveredId, setHoveredId] = createSignal<string | null>(null);
  const mapCtx = useMap();

  onMount(async () => {
    try {
      const todayMarkers = await fetchTodayPlates();
      setMarkers(todayMarkers);
    } catch {
      // silently fail
    }
  });

  function addPlateMarker(marker: PlateMarkerData) {
    setMarkers((prev) => [...prev, marker]);
  }

  function handleClick(marker: PlateMarkerData) {
    mapCtx.flyToCoords(marker.coords, BUNDESLAND_ZOOM, undefined);
  }

  const contextValue: RegionMarkersContextValue = { addPlateMarker };

  return (
    <RegionMarkersContext.Provider value={contextValue}>
      <div
        class="region-markers-layer"
        style={{ position: 'fixed', inset: '0', 'z-index': '1', 'pointer-events': 'none' }}
      >
        <For each={markers()}>
          {(marker) => (
            <div
              data-testid="region-marker"
              class={`region-marker ${hoveredId() === marker.id ? 'marker-raised' : ''}`}
              style={{
                position: 'absolute',
                'pointer-events': 'auto',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredId(marker.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleClick(marker)}
            >
              {/* The plate sign */}
              <div data-testid="marker-plate" class="marker-plate-sign">
                <span class="marker-plate-code">{marker.code}</span>
              </div>
              {/* The stick */}
              <div data-testid="marker-stick" class="marker-stick" />
            </div>
          )}
        </For>
      </div>
    </RegionMarkersContext.Provider>
  );
};

export default RegionMarkers;
