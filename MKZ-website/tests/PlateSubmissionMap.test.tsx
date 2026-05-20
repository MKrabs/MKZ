/**
 * PlateSubmission map integration tests.
 */
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapContext, type MapContextValue } from '~/components/map';
import { fetchGeoRegions } from '~/api/kennzeichen';
import PlateSubmission from '../src/components/features/PlateSubmission';

// ─── PB mock ──────────────────────────────────────────────────────────────────

const _colMocks: Record<string, any> = {};

function col(name: string) {
  if (!_colMocks[name]) {
    _colMocks[name] = { getFirstListItem: vi.fn(), getFullList: vi.fn(), create: vi.fn() };
  }
  return _colMocks[name];
}

vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn((name: string) => col(name)),
    authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() },
    autoCancellation: vi.fn(),
  },
}));
vi.mock('../src/store/auth', () => ({
  user: () => null, setUser: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(),
}));

// Mock fetchGeoRegions so we control what centroid gets computed
vi.mock('../src/api/kennzeichen', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/kennzeichen')>();
  return {
    ...actual, fetchGeoRegions: vi.fn(),
  };
});

// ─── Map context ──────────────────────────────────────────────────────────────

const mockFlyToCoords = vi.fn();

function makeMapContext(overrides: Partial<MapContextValue> = {}): MapContextValue {
  return {
    map: () => null,
    flyToCity: vi.fn(),
    flyToCoords: mockFlyToCoords,
    isIdle: () => false,
    stopIdle: vi.fn(),
    startIdle: vi.fn(), ...overrides,
  };
}

function renderWithMapCtx(ctx?: Partial<MapContextValue>) {
  return render(() => (<MapContext.Provider value={makeMapContext(ctx)}>
      <PlateSubmission/>
    </MapContext.Provider>));
}

function typeInPlate(text: string) {
  const input = screen.getByTestId('license-plate-input') as HTMLInputElement;
  input.value = text;
  fireEvent.input(input);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build a fake geo region with a square bbox centred on [lon, lat]
function makeGeoRegion(lon: number, lat: number, gen = 'Test') {
  const d = 0.1;
  return [{
    id: 'geo1', ags: '00000', gen, low: {
      type: 'Polygon',
      coordinates: [[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]],
    }, high: null,
  }];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlateSubmission — 2-col layout', () => {
  beforeEach(() => {
    Object.values(_colMocks).forEach((c: any) => Object.values(c).forEach((fn: any) => fn.mockReset?.()));
    mockFlyToCoords.mockClear();
    vi.mocked(fetchGeoRegions).mockResolvedValue([]);
  });

  it('renders the map preview box', () => {
    renderWithMapCtx();
    expect(screen.getByTestId('map-preview-box')).toBeInTheDocument();
  });

  it('preview box shows idle hint when no plate entered', () => {
    renderWithMapCtx();
    expect(screen.getByText(/Type a plate/i)).toBeInTheDocument();
  });

  it('preview shows region badge after successful lookup', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      id: 'kz1',
      code: 'M',
      district_name: 'München',
      bundesland: 'Bayern',
      bundesland_iso: 'DE-BY',
      derivation: 'München',
      active: true,
      notes: '',
    });
    vi.mocked(fetchGeoRegions).mockResolvedValueOnce(makeGeoRegion(11.58, 48.13, 'München'));
    renderWithMapCtx();
    typeInPlate('M AB 1234');
    await waitFor(() => {
      expect(screen.getByTestId('preview-region-badge')).toBeInTheDocument();
    }, { timeout: 1500 });
  });

  it('preview returns to idle hint when plate is cleared', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      id: 'kz1',
      code: 'M',
      district_name: 'München',
      bundesland: 'Bayern',
      bundesland_iso: 'DE-BY',
      derivation: 'München',
      active: true,
      notes: '',
    });
    vi.mocked(fetchGeoRegions).mockResolvedValueOnce(makeGeoRegion(11.58, 48.13));
    renderWithMapCtx();
    typeInPlate('M AB 1234');
    await waitFor(() => expect(screen.getByTestId('preview-region-badge')).toBeInTheDocument(), { timeout: 1500 });
    typeInPlate('');
    await waitFor(() => {
      expect(screen.queryByTestId('preview-region-badge')).toBeNull();
      expect(screen.getByText(/Type a plate/i)).toBeInTheDocument();
    }, { timeout: 1500 });
  });
});

describe('PlateSubmission — map pan on plate input', () => {
  beforeEach(() => {
    Object.values(_colMocks).forEach((c: any) => Object.values(c).forEach((fn: any) => fn.mockReset?.()));
    mockFlyToCoords.mockClear();
  });

  it('pans to geo_region centroid for M', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      id: 'kz-m',
      code: 'M',
      district_name: 'München',
      bundesland: 'Bayern',
      bundesland_iso: 'DE-BY',
      derivation: 'München',
      active: true,
      notes: '',
    });
    // bbox centred on [11.58, 48.13] → centroid = [11.58, 48.13]
    vi.mocked(fetchGeoRegions).mockResolvedValueOnce(makeGeoRegion(11.58, 48.13, 'München'));
    renderWithMapCtx();
    typeInPlate('M AB 1234');
    await waitFor(() => {
      expect(mockFlyToCoords).toHaveBeenCalledWith([11.58, 48.13], 9, expect.any(Array));
    }, { timeout: 1500 });
  });

  it('pans to geo_region centroid for B (Berlin)', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      id: 'kz-b',
      code: 'B',
      district_name: 'Berlin',
      bundesland: 'Berlin',
      bundesland_iso: 'DE-BE',
      derivation: 'Berlin',
      active: true,
      notes: '',
    });
    vi.mocked(fetchGeoRegions).mockResolvedValueOnce(makeGeoRegion(13.40, 52.50, 'Berlin'));
    renderWithMapCtx();
    typeInPlate('B AB 1234');
    await waitFor(() => {
      expect(mockFlyToCoords).toHaveBeenCalledWith([13.40, 52.50], 9, expect.any(Array));
    }, { timeout: 1500 });
  });

  it('pans to actual Karlsruhe centroid for KA (not Stuttgart)', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      id: 'kz-ka',
      code: 'KA',
      district_name: 'Karlsruhe',
      bundesland: 'Baden-Württemberg',
      bundesland_iso: 'DE-BW',
      derivation: 'KArlsruhe',
      active: true,
      notes: '',
    });
    // KA centred on ~[8.40, 49.00], NOT Stuttgart [9.18, 48.78]
    vi.mocked(fetchGeoRegions).mockResolvedValueOnce(makeGeoRegion(8.40, 49.00, 'Karlsruhe'));
    renderWithMapCtx();
    typeInPlate('KA AB 1234');
    await waitFor(() => {
      expect(mockFlyToCoords).toHaveBeenCalledWith([8.40, 49.00], 9, expect.any(Array));
      // Must NOT pan to Stuttgart
      expect(mockFlyToCoords).not.toHaveBeenCalledWith([9.182, 48.776], expect.anything(), expect.anything());
    }, { timeout: 1500 });
  });

  it('does NOT call flyToCoords for unrecognised prefix', async () => {
    col('kennzeichen').getFirstListItem.mockRejectedValueOnce(new Error('nf'));
    renderWithMapCtx();
    typeInPlate('XYZ AB 123');
    await waitFor(() => expect(screen.getByTestId('unknown-prefix')).toBeInTheDocument(), { timeout: 1500 });
    expect(mockFlyToCoords).not.toHaveBeenCalled();
  });

  it('calls flyToCoords only once when same prefix typed multiple times', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      id: 'kz-m',
      code: 'M',
      district_name: 'München',
      bundesland: 'Bayern',
      bundesland_iso: 'DE-BY',
      derivation: 'München',
      active: true,
      notes: '',
    });
    vi.mocked(fetchGeoRegions).mockResolvedValueOnce(makeGeoRegion(11.58, 48.13));
    renderWithMapCtx();
    typeInPlate('M');
    await waitFor(() => expect(mockFlyToCoords).toHaveBeenCalledTimes(1), { timeout: 1500 });
    // Same prefix, more text → no re-pan
    typeInPlate('M AB 9999');
    await new Promise((r) => setTimeout(r, 600));
    expect(mockFlyToCoords).toHaveBeenCalledTimes(1);
  });
});
