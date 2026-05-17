/**
 * Known cities with their geographic coordinates for map navigation.
 * Coordinates are [longitude, latitude] — MapLibre convention.
 */
export interface City {
  key: string;
  name: string;
  /** [longitude, latitude] */
  center: [number, number];
  /** Zoom level that nicely frames the city area */
  zoom: number;
}

export const CITIES: Record<string, City> = {
  berlin: {
    key: 'berlin',
    name: 'Berlin',
    center: [13.405, 52.52],
    zoom: 9,
  },
  munich: {
    key: 'munich',
    name: 'München',
    center: [11.582, 48.1351],
    zoom: 9,
  },
  karlsruhe: {
    key: 'karlsruhe',
    name: 'Karlsruhe',
    center: [8.4037, 49.0069],
    zoom: 10,
  },
} as const;

export type CityKey = keyof typeof CITIES;
