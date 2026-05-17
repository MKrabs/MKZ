import { describe, it, expect } from 'vitest';
import { CITIES } from '../src/data/cities';

describe('cities data', () => {
  it('has Berlin with correct coords', () => {
    expect(CITIES.berlin).toBeDefined();
    expect(CITIES.berlin.name).toBe('Berlin');
    expect(CITIES.berlin.center).toHaveLength(2);
    const [lng, lat] = CITIES.berlin.center;
    // Berlin is around 13.4°E, 52.5°N
    expect(lng).toBeGreaterThan(13);
    expect(lng).toBeLessThan(14);
    expect(lat).toBeGreaterThan(52);
    expect(lat).toBeLessThan(53);
  });

  it('has Munich with correct coords', () => {
    expect(CITIES.munich).toBeDefined();
    const [lng, lat] = CITIES.munich.center;
    // Munich is around 11.58°E, 48.14°N
    expect(lng).toBeGreaterThan(11);
    expect(lng).toBeLessThan(12);
    expect(lat).toBeGreaterThan(48);
    expect(lat).toBeLessThan(49);
  });

  it('has Karlsruhe with correct coords', () => {
    expect(CITIES.karlsruhe).toBeDefined();
    const [lng, lat] = CITIES.karlsruhe.center;
    // Karlsruhe is around 8.4°E, 49.0°N
    expect(lng).toBeGreaterThan(8);
    expect(lng).toBeLessThan(9);
    expect(lat).toBeGreaterThan(48.9);
    expect(lat).toBeLessThan(50);
  });

  it('each city has a zoom level between 5 and 15', () => {
    for (const city of Object.values(CITIES)) {
      expect(city.zoom).toBeGreaterThanOrEqual(5);
      expect(city.zoom).toBeLessThanOrEqual(15);
    }
  });

  it('each city has a unique key matching its record key', () => {
    for (const [key, city] of Object.entries(CITIES)) {
      expect(city.key).toBe(key);
    }
  });
});
