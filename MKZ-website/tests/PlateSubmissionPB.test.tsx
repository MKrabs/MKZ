/**
 * PlateSubmission integration tests — new seen_plates schema
 *
 * Key differences from old tests:
 * - checkSeen is now by plate_text (not plate_code)
 * - markSeen now needs kennzeichen.id (not code string)
 * - seen entries can have an image field
 * - UI has 3 states: new / seen-no-photo / seen-with-photo
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { MapContext, type MapContextValue } from '~/components/map';

// ─── PB mock ─────────────────────────────────────────────────────────────────
const _colMocks: Record<string, any> = {};
function col(name: string) {
  if (!_colMocks[name]) {
    _colMocks[name] = {
      getFirstListItem: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      getList: vi.fn(),
      update: vi.fn(),
    };
  }
  return _colMocks[name];
}

vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn((name: string) => col(name)),
    authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() },
    autoCancellation: vi.fn(),
    files: { getURL: vi.fn((_r: any, fn: string) => `http://pb/img/${fn}`) },
  },
}));

// ─── Auth mock ────────────────────────────────────────────────────────────────
let mockUser: any = null;
vi.mock('../src/store/auth', () => ({
  user: () => mockUser,
  setUser: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(),
}));

// ─── Map mock ─────────────────────────────────────────────────────────────────
const mockFlyToCoords = vi.fn();
function makeCtx(overrides: Partial<MapContextValue> = {}): MapContextValue {
  return {
    map: () => null, flyToCity: vi.fn(), flyToCoords: mockFlyToCoords,
    isIdle: () => false, stopIdle: vi.fn(), startIdle: vi.fn(),
    ...overrides,
  };
}

import PlateSubmission from '../src/components/features/PlateSubmission';

function renderPS(ctx?: Partial<MapContextValue>) {
  return render(() => (
    <MapContext.Provider value={makeCtx(ctx)}>
      <PlateSubmission />
    </MapContext.Provider>
  ));
}

function typeInPlate(text: string) {
  const input = screen.getByTestId('license-plate-input') as HTMLInputElement;
  input.value = text;
  fireEvent.input(input);
}

// ─── Common kz record ─────────────────────────────────────────────────────────
const KA_KZ = {
  id: 'kz-ka-001',
  code: 'KA',
  district_name: 'Karlsruhe',
  bundesland: 'Baden-Württemberg',
  bundesland_iso: 'DE-BW',
  derivation: 'KArlsruhe',
  active: true,
  notes: '',
};

const TIMEOUT = { timeout: 1800 };

// ─── Anonymous user ────────────────────────────────────────────────────────────

describe('PlateSubmission — anonymous', () => {
  beforeEach(() => {
    mockUser = null;
    vi.useFakeTimers();
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    mockFlyToCoords.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('shows region info after debounce', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce(KA_KZ);
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderPS();
    typeInPlate('KA NR 355');
    await vi.advanceTimersByTimeAsync(450);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    expect(screen.getByTestId('region-info')).toBeInTheDocument();
    expect(screen.getByTestId('preview-region-badge')).toBeInTheDocument();
  });

  it('shows sign-in prompt when region is found and user is anonymous', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce(KA_KZ);
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderPS();
    typeInPlate('KA NR 355');
    await vi.advanceTimersByTimeAsync(450);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    expect(screen.getByTestId('sign-in-to-collect')).toBeInTheDocument();
    expect(screen.queryByTestId('mark-seen-btn')).toBeNull();
  });

  it('shows whimsical login-nudge component (not plain text) when plate is found anonymously', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce(KA_KZ);
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderPS();
    typeInPlate('KA NR 355');
    await vi.advanceTimersByTimeAsync(450);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // The whimsical nudge component must be present
    expect(screen.getByTestId('login-nudge')).toBeInTheDocument();
    // Must have the animated SVG arrow
    expect(screen.getByTestId('login-nudge-arrow')).toBeInTheDocument();
    // Must NOT show the submit button
    expect(screen.queryByTestId('mark-seen-btn')).toBeNull();
  });

  it('checks seen_plates by exact plate_text (requires logged-in user)', async () => {
    mockUser = { id: 'user123', name: 'Max', email: 'max@test.com' }; // need auth
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce(KA_KZ);
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderPS();
    typeInPlate('KA NR 355');
    await vi.advanceTimersByTimeAsync(450);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // seen check must include the full uppercased text
    expect(col('seen_plates').getFirstListItem).toHaveBeenCalledWith(
      expect.stringContaining('plate_text = "KA NR 355"'),
    );
  });

  it('does not re-pan for same prefix when only text changes (requires auth)', async () => {
    mockUser = { id: 'user123', name: 'Max', email: 'max@test.com' };
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce(KA_KZ);
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderPS();
    typeInPlate('KA NR 355');
    await vi.advanceTimersByTimeAsync(450);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // First type: should pan
    expect(mockFlyToCoords).toHaveBeenCalledTimes(1);
    mockFlyToCoords.mockClear();

    // Add more text, same prefix "KA"
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));
    typeInPlate('KA NR 356');
    await vi.advanceTimersByTimeAsync(450);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // Same prefix → no second pan
    expect(mockFlyToCoords).not.toHaveBeenCalled();
    // But seen_plates was queried again with new text
    expect(col('seen_plates').getFirstListItem).toHaveBeenCalledWith(
      expect.stringContaining('plate_text = "KA NR 356"'),
    );
  });
});

// ─── Logged-in user ────────────────────────────────────────────────────────────

describe('PlateSubmission — logged-in', () => {
  beforeEach(() => {
    mockUser = { id: 'user123', name: 'Max', email: 'max@test.com' };
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    mockFlyToCoords.mockClear();
  });

  async function setup(plate: string, seenMock: 'new' | 'no-photo' | 'with-photo') {
    const seenRecord =
      seenMock === 'new'
        ? null
        : seenMock === 'no-photo'
        ? { id: 'sp1', user: 'user123', kennzeichen: 'kz-ka-001', plate_text: 'KA NR 355', image: '', noted_at: '2026-05-17' }
        : { id: 'sp1', user: 'user123', kennzeichen: 'kz-ka-001', plate_text: 'KA NR 355', image: 'photo.jpg', noted_at: '2026-05-17' };

    col('kennzeichen').getFirstListItem.mockResolvedValueOnce(KA_KZ);
    if (seenRecord) {
      col('seen_plates').getFirstListItem.mockResolvedValueOnce(seenRecord);
    } else {
      col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));
    }

    renderPS();
    typeInPlate(plate);
  }

  // ── New plate ──────────────────────────────────────────────────────────────

  it('NEW: shows "Mark as Found!" when plate is not yet in collection', async () => {
    await setup('KA NR 355', 'new');
    await waitFor(() => expect(screen.getByTestId('mark-seen-btn')).toBeInTheDocument(), TIMEOUT);
    expect(screen.queryByTestId('already-seen-msg')).toBeNull();
  });

  it('NEW: markSeen passes kennzeichen.id (not code string)', async () => {
    col('seen_plates').create.mockResolvedValueOnce({
      id: 'new1', kennzeichen: 'kz-ka-001', plate_text: 'KA NR 355', image: '', noted_at: '2026-05-17',
    });
    await setup('KA NR 355', 'new');
    await waitFor(() => expect(screen.getByTestId('mark-seen-btn')).toBeInTheDocument(), TIMEOUT);

    fireEvent.click(screen.getByTestId('mark-seen-btn'));

    await waitFor(() => {
      expect(col('seen_plates').create).toHaveBeenCalledWith(
        expect.objectContaining({ kennzeichen: 'kz-ka-001', plate_text: 'KA NR 355' }),
      );
    }, TIMEOUT);
  });

  it('NEW: allows different plate texts from same kennzeichen (e.g. "KA" then "KA NR 355")', async () => {
    // "KA" entry doesn't affect "KA NR 355" — different plate_text
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce(KA_KZ);
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf')); // "KA NR 355" not found

    renderPS();
    typeInPlate('KA NR 355'); // different from a previously logged "KA"

    await waitFor(() => expect(screen.getByTestId('mark-seen-btn')).toBeInTheDocument(), TIMEOUT);
    // Both "KA" and "KA NR 355" can coexist — only exact text is unique
  });

  // ── Seen, no photo ─────────────────────────────────────────────────────────

  it('NO-PHOTO: shows funny message and "Add photo" button', async () => {
    await setup('KA NR 355', 'no-photo');
    await waitFor(() => {
      expect(screen.getByTestId('already-seen-msg')).toBeInTheDocument();
      expect(screen.getByTestId('add-photo-input')).toBeInTheDocument();
      expect(screen.queryByTestId('mark-seen-btn')).toBeNull();
    }, TIMEOUT);
  });

  it('NO-PHOTO: "Add photo" calls updateSeenImage and shows image after upload', async () => {
    col('seen_plates').update.mockResolvedValueOnce({
      id: 'sp1', kennzeichen: 'kz-ka-001', plate_text: 'KA NR 355', image: 'photo.jpg', noted_at: '2026-05-17',
    });

    await setup('KA NR 355', 'no-photo');
    await waitFor(() => expect(screen.getByTestId('add-photo-input')).toBeInTheDocument(), TIMEOUT);

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('add-photo-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => {
      const arg = col('seen_plates').update.mock.calls[0][1];
      expect(arg).toBeInstanceOf(FormData);
      // After update the image should appear
      expect(screen.queryByTestId('seen-photo')).toBeInTheDocument();
    }, TIMEOUT);
  });

  it('NO-PHOTO: "Remove from list" deletes the entry', async () => {
    col('seen_plates').delete.mockResolvedValueOnce(undefined);

    await setup('KA NR 355', 'no-photo');
    await waitFor(() => expect(screen.getByTestId('remove-seen-btn')).toBeInTheDocument(), TIMEOUT);

    fireEvent.click(screen.getByTestId('remove-seen-btn'));

    await waitFor(() => {
      expect(col('seen_plates').delete).toHaveBeenCalledWith('sp1');
      expect(screen.getByTestId('mark-seen-btn')).toBeInTheDocument();
    }, TIMEOUT);
  });

  // ── Seen, with photo ───────────────────────────────────────────────────────

  it('WITH-PHOTO: shows photo thumbnail and management buttons', async () => {
    await setup('KA NR 355', 'with-photo');
    await waitFor(() => {
      expect(screen.getByTestId('already-seen-msg')).toBeInTheDocument();
      expect(screen.getByTestId('seen-photo')).toBeInTheDocument();
      expect(screen.getByTestId('remove-photo-btn')).toBeInTheDocument();
      expect(screen.getByTestId('remove-seen-btn')).toBeInTheDocument();
    }, TIMEOUT);
  });

  it('WITH-PHOTO: "Remove photo" calls removeSeenImage with filename', async () => {
    col('seen_plates').update.mockResolvedValueOnce({
      id: 'sp1', kennzeichen: 'kz-ka-001', plate_text: 'KA NR 355', image: '', noted_at: '2026-05-17',
    });

    await setup('KA NR 355', 'with-photo');
    await waitFor(() => expect(screen.getByTestId('remove-photo-btn')).toBeInTheDocument(), TIMEOUT);

    fireEvent.click(screen.getByTestId('remove-photo-btn'));

    await waitFor(() => {
      expect(col('seen_plates').update).toHaveBeenCalledWith('sp1', { 'image-': 'photo.jpg' });
    }, TIMEOUT);
  });

  it('WITH-PHOTO: after removing photo transitions back to no-photo state', async () => {
    col('seen_plates').update.mockResolvedValueOnce({
      id: 'sp1', kennzeichen: 'kz-ka-001', plate_text: 'KA NR 355', image: '', noted_at: '2026-05-17',
    });

    await setup('KA NR 355', 'with-photo');
    await waitFor(() => expect(screen.getByTestId('remove-photo-btn')).toBeInTheDocument(), TIMEOUT);

    fireEvent.click(screen.getByTestId('remove-photo-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('seen-photo')).toBeNull();
      // Back to no-photo state — shows the "add photo" prompt
      expect(screen.getByTestId('add-photo-input')).toBeInTheDocument();
    }, TIMEOUT);
  });
});
