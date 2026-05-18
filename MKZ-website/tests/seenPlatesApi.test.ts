import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Persistent PB mock ──────────────────────────────────────────────────────
const _colMocks: Record<string, any> = {};
function makeMockCol() {
  return { getFirstListItem: vi.fn(), create: vi.fn(), delete: vi.fn(), getList: vi.fn(), update: vi.fn() };
}

vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn((name: string) => {
      if (!_colMocks[name]) _colMocks[name] = makeMockCol();
      return _colMocks[name];
    }),
    authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() },
    autoCancellation: vi.fn(),
    files: { getURL: vi.fn((rec: any, filename: string) => `http://pb/files/seen_plates/${rec.id}/${filename}`) },
  },
}));

import {
  checkSeen,
  markSeen,
  updateSeenImage,
  removeSeenImage,
  removeSeen,
  listSeen,
  getSeenImageUrl,
} from '~/api/seenPlates';

function sp() {
  _colMocks['seen_plates'] ??= makeMockCol();
  return _colMocks['seen_plates'];
}

describe('seenPlates API', () => {
  beforeEach(() => {
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
  });

  // ─── checkSeen ──────────────────────────────────────────────────────────

  describe('checkSeen', () => {
    it('returns the record when exact plate_text exists', async () => {
      const rec = { id: 'sp1', plate_text: 'KA NR 355', kennzeichen: 'kz1' };
      sp().getFirstListItem.mockResolvedValueOnce(rec);
      expect(await checkSeen('u1', 'KA NR 355')).toEqual(rec);
    });

    it('queries by plate_text (uppercased)', async () => {
      sp().getFirstListItem.mockResolvedValueOnce({ id: 'sp1' });
      await checkSeen('u1', 'ka nr 355');
      expect(sp().getFirstListItem).toHaveBeenCalledWith(
        expect.stringContaining('plate_text = "KA NR 355"'),
      );
    });

    it('returns null when not found', async () => {
      sp().getFirstListItem.mockRejectedValueOnce(new Error('Not found'));
      expect(await checkSeen('u1', 'M AB 1234')).toBeNull();
    });

    it('returns null for empty userId', async () => {
      expect(await checkSeen('', 'KA')).toBeNull();
      expect(sp().getFirstListItem).not.toHaveBeenCalled();
    });

    it('returns null for empty plateText', async () => {
      expect(await checkSeen('u1', '  ')).toBeNull();
    });
  });

  // ─── markSeen ───────────────────────────────────────────────────────────

  describe('markSeen', () => {
    it('creates entry with kennzeichen relation and uppercased text', async () => {
      const created = { id: 'new1', kennzeichen: 'kz1', plate_text: 'KA NR 355' };
      sp().create.mockResolvedValueOnce(created);

      const result = await markSeen('u1', 'kz1', 'ka nr 355');

      expect(sp().create).toHaveBeenCalledWith({
        user: 'u1', kennzeichen: 'kz1', plate_text: 'KA NR 355',
      });
      expect(result).toEqual(created);
    });

    it('creates via FormData when imageFile provided', async () => {
      sp().create.mockResolvedValueOnce({ id: 'new2' });
      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });

      await markSeen('u1', 'kz1', 'KA NR 355', file);

      const arg = sp().create.mock.calls[0][0];
      expect(arg).toBeInstanceOf(FormData);
      expect(arg.get('kennzeichen')).toBe('kz1');
      expect(arg.get('plate_text')).toBe('KA NR 355');
    });
  });

  // ─── updateSeenImage ─────────────────────────────────────────────────────

  describe('updateSeenImage', () => {
    it('sends FormData with the image file', async () => {
      sp().update.mockResolvedValueOnce({ id: 'sp1', image: 'new.jpg' });
      const file = new File(['img'], 'new.jpg', { type: 'image/jpeg' });

      await updateSeenImage('sp1', file);

      const [id, arg] = sp().update.mock.calls[0];
      expect(id).toBe('sp1');
      expect(arg).toBeInstanceOf(FormData);
      expect(arg.get('image')).toBe(file);
    });
  });

  // ─── removeSeenImage ─────────────────────────────────────────────────────

  describe('removeSeenImage', () => {
    it('sends image-= delete operator with filename', async () => {
      sp().update.mockResolvedValueOnce({ id: 'sp1', image: '' });

      await removeSeenImage('sp1', 'photo.jpg');

      expect(sp().update).toHaveBeenCalledWith('sp1', { 'image-': 'photo.jpg' });
    });
  });

  // ─── removeSeen ──────────────────────────────────────────────────────────

  describe('removeSeen', () => {
    it('deletes the record', async () => {
      sp().delete.mockResolvedValueOnce(undefined);
      await removeSeen('sp1');
      expect(sp().delete).toHaveBeenCalledWith('sp1');
    });
  });

  // ─── listSeen ────────────────────────────────────────────────────────────

  describe('listSeen', () => {
    it('returns items for a valid userId', async () => {
      const items = [{ id: 'sp1' }, { id: 'sp2' }];
      sp().getList.mockResolvedValueOnce({ items });
      expect(await listSeen('u1')).toEqual(items);
    });

    it('returns empty array for empty userId', async () => {
      expect(await listSeen('')).toEqual([]);
      expect(sp().getList).not.toHaveBeenCalled();
    });
  });

  // ─── getSeenImageUrl ─────────────────────────────────────────────────────

  describe('getSeenImageUrl', () => {
    it('returns empty string when record has no image', () => {
      expect(getSeenImageUrl({ id: 'sp1', image: '' } as any)).toBe('');
    });

    it('calls pb.files.getURL with the record and filename', async () => {
      const { default: pb } = await import('../src/lib/pb');
      const rec = { id: 'sp1', collectionId: 'c1', image: 'photo.jpg' } as any;

      const url = getSeenImageUrl(rec, '200x200');

      expect(pb.files.getURL).toHaveBeenCalledWith(rec, 'photo.jpg', { thumb: '200x200' });
      expect(url).toBeTruthy();
    });
  });
});
