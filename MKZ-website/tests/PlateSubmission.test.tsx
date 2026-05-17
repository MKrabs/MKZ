/**
 * PlateSubmission core tests — structural rendering and basic state.
 * Full integration tests (debounce, PB lookup, seen check) are in PlateSubmissionPB.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { MapContext, type MapContextValue } from '../src/components/map/MapContext';

// ─── PB + auth mocks ──────────────────────────────────────────────────────────
vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn(() => ({
      getFirstListItem: vi.fn().mockRejectedValue(new Error('nf')),
      create: vi.fn(),
      delete: vi.fn(),
    })),
    authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() },
    autoCancellation: vi.fn(),
  },
}));

vi.mock('../src/store/auth', () => ({
  user: () => null,
  setUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

const mockCtx: MapContextValue = {
  map: () => null,
  flyToCity: vi.fn(),
  flyToCoords: vi.fn(),
  isIdle: () => false,
  stopIdle: vi.fn(),
  startIdle: vi.fn(),
};

import PlateSubmission from '../src/components/features/PlateSubmission';

function renderPS() {
  return render(() => (
    <MapContext.Provider value={mockCtx}>
      <PlateSubmission />
    </MapContext.Provider>
  ));
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

  it('uses col-span-8 for form and col-span-4 for preview (12-col grid)', () => {
    renderPS();
    const submission = screen.getByTestId('plate-submission');
    expect(submission.className).toContain('grid-cols-12');
    // form column
    const form = submission.querySelector('.col-span-8');
    expect(form).toBeTruthy();
    // preview column
    const preview = screen.getByTestId('map-preview-box');
    expect(preview.className).toContain('col-span-4');
  });
});
