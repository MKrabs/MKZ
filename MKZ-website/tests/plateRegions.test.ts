import { describe, expect, it } from 'vitest';
import { extractPlatePrefix, getCityForPlate, PLATE_PREFIX_MAP } from '~/data/plateRegions';

describe('extractPlatePrefix', () => {
  it('extracts single-letter prefix', () => {
    expect(extractPlatePrefix('M AB 1234')).toBe('M');
  });

  it('extracts two-letter prefix', () => {
    expect(extractPlatePrefix('KA NR 355')).toBe('KA');
  });

  it('extracts prefix from dash-separated plate', () => {
    expect(extractPlatePrefix('KA-NR-355')).toBe('KA');
  });

  it('normalises to uppercase', () => {
    expect(extractPlatePrefix('m ab 1234')).toBe('M');
    expect(extractPlatePrefix('ka nr 355')).toBe('KA');
  });

  it('returns empty string for empty input', () => {
    expect(extractPlatePrefix('')).toBe('');
  });

  it('returns empty string for numeric-only input', () => {
    expect(extractPlatePrefix('123')).toBe('');
  });

  it('handles partial input (user still typing)', () => {
    expect(extractPlatePrefix('M')).toBe('M');
    expect(extractPlatePrefix('K')).toBe('K');
    expect(extractPlatePrefix('KA')).toBe('KA');
  });

  it('handles Berlin plate', () => {
    expect(extractPlatePrefix('B XX 123')).toBe('B');
    expect(extractPlatePrefix('B-XX-123')).toBe('B');
  });

  it('ignores leading/trailing whitespace', () => {
    expect(extractPlatePrefix('  M AB 1234  ')).toBe('M');
  });
});

describe('getCityForPlate', () => {
  it('returns munich for M prefix', () => {
    expect(getCityForPlate('M AB 1234')).toBe('munich');
    expect(getCityForPlate('M')).toBe('munich');
  });

  it('returns berlin for B prefix', () => {
    expect(getCityForPlate('B XX 123')).toBe('berlin');
    expect(getCityForPlate('B')).toBe('berlin');
  });

  it('returns karlsruhe for KA prefix', () => {
    expect(getCityForPlate('KA NR 355')).toBe('karlsruhe');
    expect(getCityForPlate('KA')).toBe('karlsruhe');
  });

  it('returns null for unrecognised prefix', () => {
    expect(getCityForPlate('HH AB 123')).toBeNull();
    expect(getCityForPlate('MUC AB 123')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(getCityForPlate('')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(getCityForPlate('m ab 1234')).toBe('munich');
    expect(getCityForPlate('ka nr 355')).toBe('karlsruhe');
  });

  it('prefers longer match over shorter (KA > K)', () => {
    // KA should match karlsruhe, not fallback to some K prefix
    expect(getCityForPlate('KA NR 355')).toBe('karlsruhe');
  });
});

describe('PLATE_PREFIX_MAP', () => {
  it('has entries for all test cities', () => {
    expect(PLATE_PREFIX_MAP['M']).toBe('munich');
    expect(PLATE_PREFIX_MAP['B']).toBe('berlin');
    expect(PLATE_PREFIX_MAP['KA']).toBe('karlsruhe');
  });
});
