/**
 * Region outline data utilities.
 *
 * Provides access to German Kreise (district) boundaries
 * fetched from the Regionalatlas (statistikportal.de).
 *
 * Two resolutions available:
 * - Low-res: simplified polygons for overview zoom levels (~600KB)
 * - High-res: full detail polygons for close zoom (~19MB)
 *
 * Data format: GeoJSON FeatureCollection with properties { ags, gen }
 * where ags = Amtlicher Gemeindeschlüssel, gen = name.
 */

import lowResData from './region-outlines-low.json';

// High-res is large — lazy-load only when needed
let highResData: any = null;

export interface RegionFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    ags: string;
    gen: string;
  };
}

export interface RegionFeatureCollection {
  type: 'FeatureCollection';
  features: RegionFeature[];
}

/** Get the full low-res FeatureCollection (all 400 Kreise, simplified) */
export function getRegionOutlineLow(): RegionFeatureCollection {
  return lowResData as RegionFeatureCollection;
}

/** Get the full high-res FeatureCollection (lazy-loaded) */
export async function getRegionOutlineHigh(): Promise<RegionFeatureCollection> {
  if (!highResData) {
    highResData = await import('./region-outlines-high.json');
  }
  return highResData as RegionFeatureCollection;
}

/** Look up a single region feature by AGS code (from low-res) */
export function getRegionOutline(ags: string): RegionFeature | null {
  const feature = (lowResData as RegionFeatureCollection).features.find(
    (f) => f.properties.ags === ags
  );
  return feature ?? null;
}

/** Look up a region feature by name (from low-res) */
export function getRegionOutlineByName(name: string): RegionFeature | null {
  const feature = (lowResData as RegionFeatureCollection).features.find(
    (f) => f.properties.gen === name
  );
  return feature ?? null;
}
