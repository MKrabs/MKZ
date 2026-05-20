/**
 * PlateSubmission core tests — structural rendering and basic state.
 * Full integration tests (debounce, PB lookup, seen check) are in PlateSubmissionPB.test.tsx
 */
import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapContext, type MapContextValue } from '~/components/map';
import PlateSubmission from '../src/components/features/PlateSubmission';

// ─── PB + auth mocks ──────────────────────────────────────────────────────────
vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn(() => ({
      getFirstListItem: vi.fn().mockRejectedValue(new Error('nf')), create: vi.fn(), delete: vi.fn(),
    })), authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() }, autoCancellation: vi.fn(),
  },
}));

vi.mock('../src/store/auth', () => ({
  user: () => null, setUser: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(),
}));

const mockCtx: MapContextValue = {
  map: () => null, flyToCity: vi.fn(), flyToCoords: vi.fn(), isIdle: () => false, stopIdle: vi.fn(), startIdle: vi.fn(),
};

function renderPS() {
  return render(() => (<MapContext.Provider value={mockCtx}>
      <PlateSubmission/>
    </MapContext.Provider>));
}

describe('PlateSubmission', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the submission form', () => {
    renderPS();
    expect(screen.getByTestId('plate-submission')).toBeInTheDocument();
    expect(screen.getByText('Submit a Plate')).toBeInTheDocument();
  });

  it('renders the license plate input', () => {
    renderPS();
    expect(screen.getByTestId('license-plate-input')).toBeInTheDocument();
  });

  it('shows optional upload hint is not shown in idle state (photo is context-sensitive)', () => {
    // The photo upload now only appears when a plate + region is recognised
    renderPS();
    // No kennzeichen found yet — no upload area shown at top level
    expect(screen.queryByTestId('image-upload-input')).toBeNull();
  });

  it('renders the map preview box', () => {
    renderPS();
    expect(screen.getByTestId('map-preview-box')).toBeInTheDocument();
  });

  it('shows idle hint in preview box when no plate is typed', () => {
    renderPS();
    expect(screen.getByText(/Type a plate/i)).toBeInTheDocument();
  });

  it('uses responsive grid layout with form and preview columns', () => {
    renderPS();
    const submission = screen.getByTestId('plate-submission');
    // Outer wrapper is a bare grid (no background) so map preview is transparent
    expect(submission.tagName).toBe('DIV');
    expect(submission.querySelector('[data-testid="map-preview-box"]')).toBeTruthy();
  });
});
