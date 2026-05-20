/**
 * SolidJS context for sharing the MapLibre map instance
 * and map control functions across the component tree.
 */
import type maplibregl from 'maplibre-gl';
import { type Accessor, createContext, useContext } from 'solid-js';

export interface MapContextValue {
  /** The MapLibre Map instance, null until loaded */
  map: Accessor<maplibregl.Map | null>;
  /**
   * Fly to a named city (uses CITIES lookup).
   * @param cityKey   Key from CITIES record
   * @param offset    Pixel [x, y] offset from viewport center
   */
  flyToCity: (cityKey: string, offset?: [number, number]) => void;
  /**
   * Fly to an arbitrary coordinate.
   * @param center    [longitude, latitude]
   * @param zoom      Target zoom level
   * @param offset    Pixel [x, y] offset from viewport center
   */
  flyToCoords: (center: [number, number], zoom: number, offset?: [number, number]) => void;
  /** Whether the idle animation is currently active */
  isIdle: Accessor<boolean>;
  stopIdle: () => void;
  startIdle: () => void;
}

export const MapContext = createContext<MapContextValue>({
  map: () => null, flyToCity: () => {
  }, flyToCoords: () => {
  }, isIdle: () => false, stopIdle: () => {
  }, startIdle: () => {
  },
});

export function useMap(): MapContextValue {
  return useContext(MapContext);
}
