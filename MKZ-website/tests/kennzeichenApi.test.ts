import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupCode } from '~/api/kennzeichen';

// ─── Persistent PocketBase mock ─────────────────────────────────────────────
// Each collection name maps to a SINGLE shared object so test setup and
// the actual API function call access the same vi.fn() references.
const _colMocks: Record<string, ReturnType<typeof makeMockCol>> = {};

function makeMockCol() {
  return {
    getFirstListItem: vi.fn(), create: vi.fn(), delete: vi.fn(), getList: vi.fn(), authWithPassword: vi.fn(),
  };
}

vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn((name: string) => {
      if (!_colMocks[name]) _colMocks[name] = makeMockCol();
      return _colMocks[name];
    }), authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() }, autoCancellation: vi.fn(),
  },
}));

describe('kennzeichen API', () => {
  beforeEach(() => {
    // Clear call history but keep implementations
    Object.values(_colMocks).forEach((col) => Object.values(col).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear()));
  });

  it('returns a record on a valid code', async () => {
    const mockRecord = {
      id: 'abc123',
      code: 'KA',
      district_name: 'Karlsruhe',
      bundesland: 'Baden-Württemberg',
      bundesland_iso: 'DE-BW',
      derivation: 'KArlsruhe',
      active: true,
      notes: '',
    };
    _colMocks['kennzeichen'] ??= makeMockCol();
    _colMocks['kennzeichen'].getFirstListItem.mockResolvedValueOnce(mockRecord);

    const result = await lookupCode('KA');
    expect(result).toEqual(mockRecord);
  });

  it('normalises code to uppercase before querying', async () => {
    _colMocks['kennzeichen'] ??= makeMockCol();
    _colMocks['kennzeichen'].getFirstListItem.mockResolvedValueOnce({ code: 'M' });

    await lookupCode('m');

    expect(_colMocks['kennzeichen'].getFirstListItem).toHaveBeenCalledWith('code = "M"');
  });

  it('returns null for an unknown code (404)', async () => {
    _colMocks['kennzeichen'] ??= makeMockCol();
    _colMocks['kennzeichen'].getFirstListItem.mockRejectedValueOnce(new Error('Not found'));

    const result = await lookupCode('XYZ');
    expect(result).toBeNull();
  });

  it('returns null for an empty string without querying', async () => {
    _colMocks['kennzeichen'] ??= makeMockCol();

    const result = await lookupCode('');
    expect(result).toBeNull();
    expect(_colMocks['kennzeichen'].getFirstListItem).not.toHaveBeenCalled();
  });

  it('returns null on network error', async () => {
    _colMocks['kennzeichen'] ??= makeMockCol();
    _colMocks['kennzeichen'].getFirstListItem.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await lookupCode('B');
    expect(result).toBeNull();
  });
});
