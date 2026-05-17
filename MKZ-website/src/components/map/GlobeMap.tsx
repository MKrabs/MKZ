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
import { CITIES } from '../../data/cities';

// ─── Map style ────────────────────────────────────────────────────────────────

const FLAT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// ─── Idle animation constants ─────────────────────────────────────────────────

/**
 * Waypoints for the idle slow-pan tour [longitude, latitude].
 */
const IDLE_WAYPOINTS: [number, number][] = [
  [10.0, 51.0],   // Germany centre
  [13.4, 52.5],   // Berlin
  [4.9, 52.4],    // Amsterdam
  [2.35, 48.85],  // Paris
  [16.4, 48.2],   // Vienna
  [9.2, 45.5],    // Milan area
  [11.6, 48.1],   // Munich
];

/** Zoom level held during idle pan */
const IDLE_ZOOM = 5;
/** Duration (ms) to ease to each waypoint */
const IDLE_PAN_DURATION = 18_000;
/** Extra pause (ms) between waypoints */
const IDLE_PAUSE_MS = 3_000;
/** How long (ms) to stay on a flyTo'd city before resuming idle */
const IDLE_RESUME_DELAY = 10_000;

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
  let idleWaypointIdx = 0;
  let idlePanTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let idleResumeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ── Idle animation ────────────────────────────────────────────────────

  function startIdle() {
    const m = mapRef;
    if (!m || idleActive) return;

    idleActive = true;
    setIsIdle(true);
    panNextWaypoint(m);
  }

  function stopIdle() {
    if (!idleActive) return;

    idleActive = false;
    setIsIdle(false);

    if (idlePanTimeoutId) {
      clearTimeout(idlePanTimeoutId);
      idlePanTimeoutId = null;
    }
    if (idleResumeTimeoutId) {
      clearTimeout(idleResumeTimeoutId);
      idleResumeTimeoutId = null;
    }

    mapRef?.stop();
  }

  function panNextWaypoint(m: maplibregl.Map) {
    if (!idleActive) return;

    const center = IDLE_WAYPOINTS[idleWaypointIdx % IDLE_WAYPOINTS.length];
    idleWaypointIdx++;

    m.easeTo({
      center,
      zoom: IDLE_ZOOM,
      bearing: 0,
      pitch: 0,
      duration: IDLE_PAN_DURATION,
    });

    idlePanTimeoutId = setTimeout(
      () => panNextWaypoint(m),
      IDLE_PAN_DURATION + IDLE_PAUSE_MS,
    );
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
    const m = new maplibregl.Map({
      container: containerRef!,
      style: FLAT_STYLE,
      center: [10.0, 51.0],
      zoom: IDLE_ZOOM,
      bearing: 0,
      pitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      renderWorldCopies: true,
      attributionControl: { compact: true },
    });

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

    onCleanup(() => {
      stopIdle();
      mapRef = null;
      m.remove();
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
