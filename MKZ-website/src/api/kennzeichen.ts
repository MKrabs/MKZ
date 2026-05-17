/**
 * PocketBase API helpers for the `kennzeichen` collection.
 * The collection is publicly readable — no auth required.
 */
import pb from '../lib/pb';

export interface KennzeichenRecord {
  id: string;
  code: string;           // e.g. "KA"
  district_name: string;  // e.g. "Karlsruhe"
  bundesland: string;     // e.g. "Baden-Württemberg"
  bundesland_iso: string; // e.g. "DE-BW"
  derivation: string;     // e.g. "KArlsruhe"
  active: boolean;
  notes: string;
}

/**
 * Look up a single Kennzeichen by its exact code.
 * Returns null if not found or on network error.
 *
 * @example lookupCode("KA")  // → { code: "KA", district_name: "Karlsruhe", … }
 * @example lookupCode("XYZ") // → null
 */
export async function lookupCode(code: string): Promise<KennzeichenRecord | null> {
  if (!code) return null;

  try {
    const record = await pb
      .collection('kennzeichen')
      .getFirstListItem<KennzeichenRecord>(`code = "${code.toUpperCase()}"`);
    return record;
  } catch {
    // 404 = not found, or any other error — treat as "unknown code"
    return null;
  }
}
