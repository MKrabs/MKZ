/**
 * MapRegionHighlighter
 *
 * Draws a filled + outlined highlight for all geo_regions linked to the
 * currently looked-up kennzeichen. Fetches geometry from PocketBase via
 * the kennzeichen_geo_regions junction table.
 *
 * Replaces the old local-JSON / name-based lookup entirely.
 */
import type maplibregl from 'maplibre-gl';
import { Component, createEffect, onCleanup } from 'solid-js';
import { buildGeoJSON, fetchGeoRegions } from '~/api/kennzeichen';
import { useMap } from './MapContext';

interface Props {
  /** The kennzeichen record id to highlight, or null to clear. */
  kennzeichenId: string | null;
}

const SOURCE_ID = 'mkz-region-highlight-source';
const FILL_LAYER = 'mkz-region-highlight-fill';
const LINE_LAYER = 'mkz-region-highlight-line';

function clearLayers(m: maplibregl.Map) {
  try {
    if (m.getLayer?.(FILL_LAYER)) m.removeLayer(FILL_LAYER);
    if (m.getLayer?.(LINE_LAYER)) m.removeLayer(LINE_LAYER);
    if (m.getSource?.(SOURCE_ID)) m.removeSource(SOURCE_ID);
  } catch {
    // ignore — map may not be fully initialised in tests
  }
}

function applyGeoJSON(m: maplibregl.Map, geojson: GeoJSON.FeatureCollection) {
  try {
    if (m.getSource?.(SOURCE_ID)) {
      (m.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      m.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
    }

    if (m.getLayer?.(FILL_LAYER)) m.removeLayer(FILL_LAYER);
    if (m.getLayer?.(LINE_LAYER)) m.removeLayer(LINE_LAYER);

    m.addLayer({
      id: FILL_LAYER, type: 'fill', source: SOURCE_ID, paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.25 },
    });

    m.addLayer({
      id: LINE_LAYER, type: 'line', source: SOURCE_ID, paint: { 'line-color': '#f59e0b', 'line-width': 2 },
    });
  } catch (e) {
    console.warn('[MapRegionHighlighter] could not apply layers', e);
  }
}

const MapRegionHighlighter: Component<Props> = (props) => {
  const mapCtx = useMap();

  // Incremented on every effect run to discard stale async results.
  let fetchSeq = 0;

  createEffect(() => {
    const m = mapCtx.map();
    const kzId = props.kennzeichenId;
    const seq = ++fetchSeq;

    if (!m) return;

    // Always clear previous highlight immediately.
    clearLayers(m);
    if (!kzId) return;

    fetchGeoRegions(kzId, 'low').then((regions) => {
      // Discard if a newer lookup has already started.
      if (seq !== fetchSeq) return;

      const m2 = mapCtx.map();
      if (!m2 || regions.length === 0) return;

      applyGeoJSON(m2, buildGeoJSON(regions, 'low'));
    });
  });

  onCleanup(() => {
    fetchSeq++; // invalidate any in-flight fetch
    const m = mapCtx.map();
    if (m) clearLayers(m);
  });

  return null;
};

export default MapRegionHighlighter;
