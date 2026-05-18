/**
 * RegionOutlines — tests for the region outline data and lookup utilities.
 */
import { describe, it, expect } from 'vitest';
import { getRegionOutline, getRegionOutlineLow } from '~/data/regionOutlines';

describe('regionOutlines — data integrity', () => {
  it('low-res data has 400 Kreise', () => {
    const data = getRegionOutlineLow();
    expect(data.type).toBe('FeatureCollection');
    expect(data.features.length).toBe(400);
  });

  it('each feature has ags and gen properties', () => {
    const data = getRegionOutlineLow();
    for (const feat of data.features.slice(0, 10)) {
      expect(feat.properties).toHaveProperty('ags');
      expect(feat.properties).toHaveProperty('gen');
      expect(feat.properties.ags).toMatch(/^\d{2,5}$/);
    }
  });

  it('can look up Berlin by AGS', () => {
    const feature = getRegionOutline('11');
    expect(feature).not.toBeNull();
    expect(feature!.properties.gen).toBe('Berlin');
  });

  it('can look up München by AGS', () => {
    const feature = getRegionOutline('09162');
    expect(feature).not.toBeNull();
    expect(feature!.properties.gen).toBe('München');
  });

  it('returns null for unknown AGS', () => {
    const feature = getRegionOutline('99999');
    expect(feature).toBeNull();
  });
});
