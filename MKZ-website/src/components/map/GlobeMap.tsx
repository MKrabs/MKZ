/**
 * GlobeMap — full-screen MapLibre map background.
 *
 * Behaviour:
 * - Fixed position, z-index 0 (behind all UI)
 * - Default style: flat vector map (OpenFreeMap Liberty)
 * - North is ALWAYS up. Rotation is disabled at all times.
 * - Idle animation: slow easeTo pan tour through European cities.
 * - flyToCity: stops idle, flies to city, resumes idle after IDLE_RESUME_DELAY.
 * - Provides MapContext to child components.
 */
import { Component, JSX, createSignal, onMount, onCleanup } from 'solid-js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { MapContext, type MapContextValue } from './MapContext';
import { CITIES } from '~/data/cities';

// ─── Map style ─────────────────────────────────────────────────────────────

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function getTileUrl() {
  const tilePath = '/tiles/{z}/{x}/{y}';

  if (import.meta.env.DEV) {
    return `http://localhost:3100${tilePath}`;
  }

  return `${window.location.origin}${tilePath}`;
}

// ─── Idle animation constants ─────────────────────────────────────────────────

/** How long (ms) to stay on a flyTo'd city before resuming idle */
const IDLE_RESUME_DELAY = 10_000;
/** Default zoom level for idle state */
const IDLE_ZOOM = 5;

// ─── Component ────────────────────────────────────────────────────────────────

interface GlobeMapProps {
  children?: JSX.Element;
}

const GlobeMap: Component<GlobeMapProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;

  // Direct mutable ref for internal use (avoids signal overhead in timer callbacks)
  let mapRef: maplibregl.Map | null = null;

  const [mapInstance, setMapInstance] = createSignal<maplibregl.Map | null>(null);
  const [isIdle, setIsIdle] = createSignal(false);

  // Idle state
  let idleActive = false;
  let idleResumeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ── Idle animation ────────────────────────────────────────────────────

  function startIdle() {
    const m = mapRef;
    if (!m || idleActive) return;

    idleActive = true;
    setIsIdle(true);
  }

  function stopIdle() {
    if (!idleActive) return;

    idleActive = false;
    setIsIdle(false);

    if (idleResumeTimeoutId) {
      clearTimeout(idleResumeTimeoutId);
      idleResumeTimeoutId = null;
    }

    mapRef?.stop();
  }

  // ── flyToCity ─────────────────────────────────────────────────────────

  function flyToCity(cityKey: string, offset?: [number, number]) {
    const m = mapRef;
    const city = CITIES[cityKey];
    if (!m || !city) return;
    flyToCoords(city.center, city.zoom, offset);
  }

  function flyToCoords(
    center: [number, number],
    zoom: number,
    offset?: [number, number],
  ) {
    const m = mapRef;
    if (!m) return;

    stopIdle();

    m.flyTo({
      center,
      zoom,
      bearing: 0,
      pitch: 0,
      offset: offset ?? [0, 0],
      duration: 2200,
      essential: true,
    });

    idleResumeTimeoutId = setTimeout(startIdle, IDLE_RESUME_DELAY);
  }

  // ── Map lifecycle ─────────────────────────────────────────────────────
  onMount(() => {
    let disposed = false;
    let createdMap: maplibregl.Map | null = null;

    async function initMap() {
      try {
        const style = await fetch(STYLE_URL).then(r => r.json());

        if (disposed) return;

        if (style.sources?.openmaptiles) {
          style.sources.openmaptiles.tiles = [getTileUrl()];
          delete style.sources.openmaptiles.url;
        }

        const m = new maplibregl.Map({
          container: containerRef!,
          style,
          center: [10.0, 51.0],
          zoom: IDLE_ZOOM,
          bearing: 0,
          pitch: 0,
          dragRotate: false,
          pitchWithRotate: false,
          renderWorldCopies: true,
          attributionControl: { compact: true },
        });

        if (disposed) {
          m.remove();
          return;
        }

        createdMap = m;
        mapRef = m;

        m.on('load', () => {
          // Allow pinch-zoom but never pinch-rotate
          m.touchZoomRotate.disableRotation();

          setMapInstance(m);
          startIdle();
        });

        m.on('error', (e) => {
          if (e.error?.message?.includes('Failed to fetch')) return;
          console.error('[GlobeMap]', e.error);
        });
      } catch (err) {
        if (!disposed) {
          console.error('[GlobeMap] failed to initialise map', err);
        }
      }
    }

    void initMap();

    onCleanup(() => {
      disposed = true;
      stopIdle();
      mapRef = null;
      createdMap?.remove();
    });
  });

  // ── Context ───────────────────────────────────────────────────────────

  const contextValue: MapContextValue = {
    map: mapInstance,
    flyToCity,
    flyToCoords,
    isIdle,
    stopIdle,
    startIdle,
  };

  return (
    <MapContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        data-testid="globe-map-container"
        style={{ position: 'fixed', inset: '0', 'z-index': '0' }}
      />
      {props.children}
    </MapContext.Provider>
  );
};

export default GlobeMap;
