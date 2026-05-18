/**
 * PlateSubmission map integration tests.
 * These test that typing a plate triggers a debounced PB lookup,
 * and if found, calls flyToCoords with the bundesland coordinates.
 *
 * Full detail tests are in PlateSubmissionPB.test.tsx.
 * This file focuses on the map pan behaviour specifically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { MapContext, type MapContextValue } from '~/components/map';

// ─── PB mock ────────────────────────────────────────────────────────────────
const _colMocks: Record<string, any> = {};
function col(name: string) {
  if (!_colMocks[name]) {
    _colMocks[name] = { getFirstListItem: vi.fn(), create: vi.fn(), delete: vi.fn() };
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
  user: () => null, // anonymous
  setUser: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(),
}));

// ─── Map context ─────────────────────────────────────────────────────────────
const mockFlyToCoords = vi.fn();

function makeMapContext(overrides: Partial<MapContextValue> = {}): MapContextValue {
  return {
    map: () => null,
    flyToCity: vi.fn(),
    flyToCoords: mockFlyToCoords,
    isIdle: () => false,
    stopIdle: vi.fn(),
    startIdle: vi.fn(),
    ...overrides,
  };
}

import PlateSubmission from '../src/components/features/PlateSubmission';

function renderWithMapCtx(ctx?: Partial<MapContextValue>) {
  return render(() => (
    <MapContext.Provider value={makeMapContext(ctx)}>
      <PlateSubmission />
    </MapContext.Provider>
  ));
}

function typeInPlate(text: string) {
  const input = screen.getByTestId('license-plate-input') as HTMLInputElement;
  input.value = text;
  fireEvent.input(input);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlateSubmission — 2-col layout', () => {
  beforeEach(() => {
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    mockFlyToCoords.mockClear();
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
      code: 'M', district_name: 'München', bundesland: 'Bayern',
      bundesland_iso: 'DE-BY', derivation: 'München', active: true, notes: '',
    });
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderWithMapCtx();
    typeInPlate('M AB 1234');

    await waitFor(() => {
      expect(screen.getByTestId('preview-region-badge')).toBeInTheDocument();
    }, { timeout: 1500 });
  });

  it('preview returns to idle hint when plate is cleared', async () => {
    col('kennzeichen').getFirstListItem
      .mockResolvedValueOnce({
        code: 'M', district_name: 'München', bundesland: 'Bayern',
        bundesland_iso: 'DE-BY', derivation: 'München', active: true, notes: '',
      })
      .mockRejectedValueOnce(new Error('nf')); // second lookup for empty prefix won't happen

    renderWithMapCtx();
    typeInPlate('M AB 1234');

    await waitFor(() => expect(screen.getByTestId('preview-region-badge')).toBeInTheDocument(),
      { timeout: 1500 });

    // Clear the plate
    typeInPlate('');

    await waitFor(() => {
      expect(screen.queryByTestId('preview-region-badge')).toBeNull();
      expect(screen.getByText(/Type a plate/i)).toBeInTheDocument();
    }, { timeout: 1500 });
  });
});

describe('PlateSubmission — map pan on plate input', () => {
  beforeEach(() => {
    Object.values(_colMocks).forEach((c: any) =>
      Object.values(c).forEach((fn: any) => fn.mockReset?.()),
    );
    mockFlyToCoords.mockClear();
  });

  async function lookupAndWait(code: string, iso: string, expectedCoords: [number, number]) {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      code, district_name: code, bundesland: 'Test',
      bundesland_iso: iso, derivation: code, active: true, notes: '',
    });
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderWithMapCtx();
    typeInPlate(code + ' AB 1234');

    await waitFor(() => {
      expect(mockFlyToCoords).toHaveBeenCalledWith(expectedCoords, 8, expect.any(Array));
    }, { timeout: 1500 });
  }

  it('pans to München for M (DE-BY)', async () => {
    await lookupAndWait('M', 'DE-BY', [11.582, 48.135]);
  });

  it('pans to Berlin for B (DE-BE)', async () => {
    await lookupAndWait('B', 'DE-BE', [13.405, 52.52]);
  });

  it('pans to Stuttgart for KA (DE-BW)', async () => {
    await lookupAndWait('KA', 'DE-BW', [9.182, 48.776]);
  });

  it('does NOT call flyToCoords for unrecognised prefix', async () => {
    col('kennzeichen').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderWithMapCtx();
    typeInPlate('XYZ AB 123');

    // Wait for the debounce + lookup to complete
    await waitFor(() => expect(screen.getByTestId('unknown-prefix')).toBeInTheDocument(),
      { timeout: 1500 });

    expect(mockFlyToCoords).not.toHaveBeenCalled();
  });

  it('calls flyToCoords only once when same prefix typed multiple times', async () => {
    col('kennzeichen').getFirstListItem.mockResolvedValueOnce({
      code: 'M', district_name: 'München', bundesland: 'Bayern',
      bundesland_iso: 'DE-BY', derivation: 'München', active: true, notes: '',
    });
    col('seen_plates').getFirstListItem.mockRejectedValueOnce(new Error('nf'));

    renderWithMapCtx();
    typeInPlate('M');

    await waitFor(() => expect(mockFlyToCoords).toHaveBeenCalledTimes(1), { timeout: 1500 });

    // Type more but keep same prefix → same lastCheckedPrefix, no re-query
    typeInPlate('M AB 9999');
    await new Promise((r) => setTimeout(r, 600)); // wait > 400ms

    // Still only once
    expect(mockFlyToCoords).toHaveBeenCalledTimes(1);
  });
});
