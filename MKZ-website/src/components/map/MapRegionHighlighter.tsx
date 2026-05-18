import { Component, createEffect, onCleanup } from 'solid-js';
import { useMap } from './MapContext';
import { getRegionOutlineByName } from '~/data/regionOutlines';
import type { RegionData } from '../features/RegionCallout';

interface Props {
  region: RegionData | null;
}

const SOURCE_ID = 'mkz-region-highlight-source';
const FILL_LAYER_ID = 'mkz-region-highlight-fill';
const LINE_LAYER_ID = 'mkz-region-highlight-line';

const MapRegionHighlighter: Component<Props> = (props) => {
  const mapCtx = useMap();

  createEffect(() => {
    const m = mapCtx.map();
    const region = props.region;

    if (!m) return;

    // Remove existing highlight first
    try {
      if (m.getLayer && m.getLayer(FILL_LAYER_ID)) {
        m.removeLayer(FILL_LAYER_ID);
      }
      if (m.getLayer && m.getLayer(LINE_LAYER_ID)) {
        m.removeLayer(LINE_LAYER_ID);
      }
      if (m.getSource && m.getSource(SOURCE_ID)) {
        m.removeSource(SOURCE_ID);
      }
    } catch (e) {
      // ignore
    }

    if (!region) return;

    const feat = getRegionOutlineByName(region.districtName);
    if (!feat) return;

    const geojson = {
      type: 'FeatureCollection',
      features: [feat],
    } as any;

    // Add source and layers
    try {
      // Some test mocks only provide addSource/addLayer; prefer using those if getSource is absent
      if (!m.getSource || !m.getLayer) {
        m.addSource && m.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
        m.addLayer && m.addLayer({ id: FILL_LAYER_ID, type: 'fill', source: SOURCE_ID, paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.25 } });
        m.addLayer && m.addLayer({ id: LINE_LAYER_ID, type: 'line', source: SOURCE_ID, paint: { 'line-color': '#f59e0b', 'line-width': 2 } });
        return;
      }

      if (!m.getSource(SOURCE_ID)) {
        m.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
      } else {
        const src = m.getSource(SOURCE_ID);
        src.setData && src.setData(geojson);
      }

      // Remove existing layers if present
      if (m.getLayer(FILL_LAYER_ID)) m.removeLayer(FILL_LAYER_ID);
      if (m.getLayer(LINE_LAYER_ID)) m.removeLayer(LINE_LAYER_ID);

      m.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.25,
        },
      });

      m.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2,
        },
      });
    } catch (err) {
      // ignore errors in environments without full map API
      console.warn('[MapRegionHighlighter] could not add layers', err);
    }
  });

  onCleanup(() => {
    const m = mapCtx.map();
    if (!m) return;
    try {
      if (m.getLayer && m.getLayer(FILL_LAYER_ID)) m.removeLayer(FILL_LAYER_ID);
      if (m.getLayer && m.getLayer(LINE_LAYER_ID)) m.removeLayer(LINE_LAYER_ID);
      if (m.getSource && m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
    } catch (e) {}
  });

  return null;
};

export default MapRegionHighlighter;
