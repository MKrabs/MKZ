/**
 * Maps German license plate prefixes to city keys.
 *
 * German plates: first 1-3 uppercase letters = district/city code.
 * e.g. "M AB 1234" → prefix "M" → Munich
 *      "KA NR 355" → prefix "KA" → Karlsruhe
 *      "B XX 123"  → prefix "B"  → Berlin
 *
 * Matching is greedy-longest-first: "KA" is checked before "K".
 */
import type { CityKey } from './cities';

/** Map from plate prefix (uppercase) → city key */
export const PLATE_PREFIX_MAP: Record<string, CityKey> = {
  M: 'munich',
  B: 'berlin',
  KA: 'karlsruhe',
} as const;

/**
 * Extracts the plate prefix from raw plate text.
 * "M AB 1234" → "M"
 * "KA-NR-355" → "KA"  (handles both space and dash separators)
 * "kA Nr 355" → "KA"  (normalises to uppercase)
 */
export function extractPlatePrefix(plateText: string): string {
  const normalised = plateText.trim().toUpperCase();
  // Split on space or dash
  const firstPart = normalised.split(/[\s-]/)[0] ?? '';
  // Plate prefixes are letters only (1-3 chars)
  const match = firstPart.match(/^[A-ZÄÖÜ]{1,3}/);
  return match ? match[0] : '';
}

/**
 * Returns the city key for the given plate text, or null if unrecognised.
 *
 * The extracted prefix must be an exact match in the PLATE_PREFIX_MAP.
 * This means "MUC AB 123" (prefix="MUC") does NOT match "M" (Munich).
 * But "M" (user still typing) DOES match Munich exactly.
 */
export function getCityForPlate(plateText: string): CityKey | null {
  const prefix = extractPlatePrefix(plateText);
  if (!prefix) return null;
  return PLATE_PREFIX_MAP[prefix] ?? null;
}
