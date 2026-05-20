/**
 * PocketBase API helpers for the `kennzeichen` collection.
 * The collection is publicly readable — no auth required.
 */
import pb from '../lib/pb';

export interface KennzeichenRecord {
  id: string;
  code: string;
  district_name: string;
  bundesland: string;
  bundesland_iso: string;
  derivation: string;
  active: boolean;
  notes: string;
}

export interface GeoRegionRecord {
  id: string;
  ags: string;
  gen: string;
  low: object | null;
  high: object | null;
}

/**
 * Look up a single Kennzeichen by its exact code.
 * Returns null if not found or on network error.
 */
export async function lookupCode(code: string): Promise<KennzeichenRecord | null> {
  if (!code) return null;
  try {
    return await pb
      .collection('kennzeichen')
      .getFirstListItem<KennzeichenRecord>(`code = "${code.toUpperCase()}"`);
  } catch {
    return null;
  }
}

/**
 * Fetch all geo_regions linked to a kennzeichen via the junction table.
 * Returns an empty array for city-states (HH, HB, HL) which have no junction rows.
 *
 * @param kennzeichenId  The kennzeichen record id
 * @param quality        'low' (default, fast) or 'high' (detailed)
 */
export async function fetchGeoRegions(kennzeichenId: string, quality: 'low' | 'high' = 'low'): Promise<GeoRegionRecord[]> {
  if (!kennzeichenId) return [];
  try {
    const junctions = await pb
      .collection('kennzeichen_geo_regions')
      .getFullList({
        filter: `kennzeichen = "${kennzeichenId}"`,
        expand: 'geo_region',
        fields: `id,expand.geo_region.id,expand.geo_region.ags,expand.geo_region.gen,expand.geo_region.${quality}`,
      });

    return junctions
      .map((j) => j.expand?.geo_region as GeoRegionRecord | undefined)
      .filter((g): g is GeoRegionRecord => !!g);
  } catch {
    return [];
  }
}

/**
 * Build a GeoJSON FeatureCollection from an array of GeoRegionRecords.
 * Merges all regions into a single collection for MapLibre.
 */
export function buildGeoJSON(regions: GeoRegionRecord[], quality: 'low' | 'high' = 'low'): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = regions
    .map((r) => {
      const geometry = r[quality];
      if (!geometry) return null;
      return {
        type: 'Feature' as const, geometry: geometry as GeoJSON.Geometry, properties: { ags: r.ags, gen: r.gen },
      };
    })
    .filter((f): f is GeoJSON.Feature => f !== null);

  return { type: 'FeatureCollection', features };
}
