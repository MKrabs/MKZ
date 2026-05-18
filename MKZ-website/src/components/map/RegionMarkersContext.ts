/**
 * Context for adding plate markers reactively from other components.
 */
import { createContext, useContext } from 'solid-js';

export interface PlateMarkerData {
  id: string;
  code: string;           // plate prefix e.g. "M", "KA"
  coords: [number, number]; // [lng, lat]
  districtName: string;
  bundeslandIso: string;
}

export interface RegionMarkersContextValue {
  /** Add a single plate marker to the map (e.g. after user submits) */
  addPlateMarker: (marker: PlateMarkerData) => void;
}

export const RegionMarkersContext = createContext<RegionMarkersContextValue>({
  addPlateMarker: () => {},
});

export function useRegionMarkers(): RegionMarkersContextValue {
  return useContext(RegionMarkersContext);
}
