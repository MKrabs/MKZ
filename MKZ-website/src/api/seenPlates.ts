/**
 * PocketBase API helpers for the `seen_plates` collection.
 *
 * Data model (v2):
 *   user        → relation to users (owner)
 *   kennzeichen → relation to kennzeichen collection
 *   plate_text  → the exact plate text typed, e.g. "KA NR 355"
 *   image       → optional single photo (filename stored by PocketBase)
 *   noted_at    → autodate (set on creation)
 *
 * Uniqueness: (user, plate_text) — a user can log the same prefix multiple
 * times with different full texts ("KA" and "KA NR 355" are separate entries),
 * but cannot log the exact same text twice.
 */
import pb from '../lib/pb';

export interface SeenPlateRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  user: string;         // users record id
  kennzeichen: string;  // kennzeichen record id
  plate_text: string;   // e.g. "KA NR 355"
  image: string;        // PocketBase filename, '' when no photo
  noted_at: string;     // ISO datetime
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Check whether the user has already logged a specific plate text.
 * Returns null if not found or if any error occurs.
 */
export async function checkSeen(userId: string, plateText: string): Promise<SeenPlateRecord | null> {
  if (!userId || !plateText.trim()) return null;

  try {
    return await pb
      .collection('seen_plates')
      .getFirstListItem<SeenPlateRecord>(`user = "${userId}" && plate_text = "${plateText.trim().toUpperCase()}"`);
  } catch {
    return null; // 404 = not logged yet
  }
}

/** Get all seen plates for a user, newest first. */
export async function listSeen(userId: string): Promise<SeenPlateRecord[]> {
  if (!userId) return [];
  const result = await pb.collection('seen_plates').getList<SeenPlateRecord>(1, 500, {
    filter: `user = "${userId}"`, sort: '-noted_at',
  });
  return result.items;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Log a newly-spotted plate.
 * @param userId         The `id` of the user (not the display name).
 * @param kennzeichenId  The `id` of the kennzeichen record (not the code string).
 * @param plateText      The exact plate text as typed by the user, e.g. "KA NR 355". Case and whitespace are normalized, but no other validation is done.
 * @param imageFile      Optional proof photo.
 */
export async function markSeen(userId: string, kennzeichenId: string, plateText: string, imageFile?: File): Promise<SeenPlateRecord> {
  if (imageFile) {
    const fd = new FormData();
    fd.append('user', userId);
    fd.append('kennzeichen', kennzeichenId);
    fd.append('plate_text', plateText.trim().toUpperCase());
    fd.append('image', imageFile);
    return pb.collection('seen_plates').create<SeenPlateRecord>(fd);
  }

  return pb.collection('seen_plates').create<SeenPlateRecord>({
    user: userId, kennzeichen: kennzeichenId, plate_text: plateText.trim().toUpperCase(),
  });
}

/**
 * Add or replace the photo on an existing seen-plate entry.
 */
export async function updateSeenImage(recordId: string, imageFile: File): Promise<SeenPlateRecord> {
  const fd = new FormData();
  fd.append('image', imageFile);
  return pb.collection('seen_plates').update<SeenPlateRecord>(recordId, fd);
}

/**
 * Remove the photo from an existing entry (the entry itself is kept).
 * PocketBase file-delete syntax: `fieldName-` = filename to remove.
 */
export async function removeSeenImage(recordId: string, imageFilename: string): Promise<SeenPlateRecord> {
  return pb.collection('seen_plates').update<SeenPlateRecord>(recordId, {
    'image-': imageFilename,
  });
}

/** Delete an entire seen-plate entry. */
export async function removeSeen(recordId: string): Promise<void> {
  await pb.collection('seen_plates').delete(recordId);
}

// ─── File URLs ────────────────────────────────────────────────────────────────

/**
 * Build the PocketBase-hosted URL for a seen-plate photo.
 * Returns '' when the record has no image.
 *
 * @param thumb  Optional thumb size string, e.g. "200x200".
 */
export function getSeenImageUrl(record: SeenPlateRecord, thumb?: string): string {
  if (!record?.image) return '';
  return pb.files.getURL(record as any, record.image, thumb ? { thumb } : undefined);
}
