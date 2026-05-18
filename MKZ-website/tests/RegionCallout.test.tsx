/**
 * RegionCallout — displays details about the currently looked-up region.
 *
 * Shows: region name, Bundesland, number of registered plates, fun fact.
 * Connected visually by a leader line with horizontal elbow connector.
 * Idle animation cycles through fun facts.
 * Only one info item shown at a time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';

// ─── PB mock ────────────────────────────────────────────────────────────────
vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn(() => ({
      getFirstListItem: vi.fn(),
      getList: vi.fn().mockResolvedValue({ items: [] }),
    })),
    authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() },
  },
}));

import RegionCallout from '../src/components/features/RegionCallout';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegionCallout — rendering', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders nothing when no region data is provided', () => {
    render(() => <RegionCallout region={null} />);
    expect(screen.queryByTestId('region-callout')).toBeNull();
  });

  it('renders callout box when region data is provided', () => {
    render(() => (
      <RegionCallout
        region={{
          code: 'M',
          districtName: 'München',
          bundesland: 'Bayern',
          plateCount: 42,
          funFacts: ['Munich has the most Biergärten in Germany.'],
        }}
      />
    ));
    expect(screen.getByTestId('region-callout')).toBeInTheDocument();
  });

  it('shows region name', () => {
    render(() => (
      <RegionCallout
        region={{
          code: 'M',
          districtName: 'München',
          bundesland: 'Bayern',
          plateCount: 42,
          funFacts: ['Fun fact here.'],
        }}
      />
    ));
    expect(screen.getByText('München')).toBeInTheDocument();
  });

  it('shows Bundesland', () => {
    render(() => (
      <RegionCallout
        region={{
          code: 'KA',
          districtName: 'Karlsruhe',
          bundesland: 'Baden-Württemberg',
          plateCount: 15,
          funFacts: ['Karlsruhe is a fan-shaped city.'],
        }}
      />
    ));
    expect(screen.getByText('Baden-Württemberg')).toBeInTheDocument();
  });

  it('shows plate count', () => {
    render(() => (
      <RegionCallout
        region={{
          code: 'B',
          districtName: 'Berlin',
          bundesland: 'Berlin',
          plateCount: 99,
          funFacts: ['Berlin is 9x the size of Paris.'],
        }}
      />
    ));
    expect(screen.getByText(/99/)).toBeInTheDocument();
  });

  it('shows a fun fact', () => {
    render(() => (
      <RegionCallout
        region={{
          code: 'M',
          districtName: 'München',
          bundesland: 'Bayern',
          plateCount: 42,
          funFacts: ['Munich hosts Oktoberfest annually.'],
        }}
      />
    ));
    expect(screen.getByText('Munich hosts Oktoberfest annually.')).toBeInTheDocument();
  });

  it('renders the leader line connector', () => {
    render(() => (
      <RegionCallout
        region={{
          code: 'M',
          districtName: 'München',
          bundesland: 'Bayern',
          plateCount: 42,
          funFacts: ['Fun fact.'],
        }}
      />
    ));
    expect(screen.getByTestId('leader-line')).toBeInTheDocument();
  });

  it('cycles through fun facts over time', async () => {
    render(() => (
      <RegionCallout
        region={{
          code: 'M',
          districtName: 'München',
          bundesland: 'Bayern',
          plateCount: 42,
          funFacts: ['Fact one.', 'Fact two.', 'Fact three.'],
        }}
      />
    ));

    expect(screen.getByTestId('fun-fact').textContent).toBe('Fact one.');

    // Advance past cycle interval (5s)
    await vi.advanceTimersByTimeAsync(5500);
    expect(screen.getByTestId('fun-fact').textContent).toBe('Fact two.');

    await vi.advanceTimersByTimeAsync(5500);
    expect(screen.getByTestId('fun-fact').textContent).toBe('Fact three.');

    // Wraps around
    await vi.advanceTimersByTimeAsync(5500);
    expect(screen.getByTestId('fun-fact').textContent).toBe('Fact one.');
  });
});
