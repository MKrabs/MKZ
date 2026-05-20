/**
 * LoginNudge — whimsical login prompt shown when a plate is found but user is not signed in.
 *
 * Renders:
 *  - A text hint referencing "sign in" and "progress" / "collection"
 *  - An animated SVG arrow pointing toward the top-right (where the Sign In button lives)
 */
import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';

import LoginNudge from '../src/components/common/LoginNudge';

describe('LoginNudge', () => {
  it('renders with data-testid="login-nudge"', () => {
    render(() => <LoginNudge/>);
    expect(screen.getByTestId('login-nudge')).toBeInTheDocument();
  });

  it('contains the text "Sign in"', () => {
    render(() => <LoginNudge/>);
    expect(screen.getByTestId('login-nudge').textContent).toMatch(/sign in/i);
  });

  it('mentions progress or collection tracking', () => {
    render(() => <LoginNudge/>);
    expect(screen.getByTestId('login-nudge').textContent).toMatch(/progress|collection|track/i);
  });

  it('renders the animated SVG arrow (data-testid="login-nudge-arrow")', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    expect(svg).toBeInTheDocument();
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('SVG arrow has a <path> element', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const path = svg.querySelector('path[d]');
    expect(path).not.toBeNull();
  });

  it('SVG arrow path uses stroke-dasharray for draw animation', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    // The animated path carries the draw-animation class or inline stroke-dasharray
    const animatedPaths = Array.from(svg.querySelectorAll('path'));
    const hasDrawEffect = animatedPaths.some((p) => p.classList.contains('draw-arrow') || p.getAttribute('stroke-dasharray') !== null || p.style.strokeDasharray !== '');
    expect(hasDrawEffect).toBe(true);
  });

  it('SVG arrow has an arrowhead (marker-end or polygon)', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const hasMarker = !!svg.querySelector('marker') || !!svg.querySelector('polygon') || Array.from(svg.querySelectorAll('path')).some((p) => p.getAttribute('marker-end') !== null || p.getAttribute('markerEnd') !== null);
    expect(hasMarker).toBe(true);
  });

  it('is non-interactive (pointer-events none on SVG)', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const isNonInteractive = svg.style.pointerEvents === 'none' || svg.classList.contains('pointer-events-none');
    expect(isNonInteractive).toBe(true);
  });

  it('SVG is position:fixed so viewport coordinates map directly', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const isFixed = svg.style.position === 'fixed' || svg.classList.contains('fixed');
    expect(isFixed).toBe(true);
  });

  it('text nudge box is also position:fixed (not confined inside a card)', () => {
    render(() => <LoginNudge/>);
    const nudge = screen.getByTestId('login-nudge');
    const isFixed = nudge.style.position === 'fixed' || nudge.classList.contains('fixed');
    expect(isFixed).toBe(true);
  });

  it('arrow stroke-width is at least 3', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const path = svg.querySelector('path[stroke-width]');
    expect(path).not.toBeNull();
    const sw = parseFloat(path!.getAttribute('stroke-width') ?? '0');
    expect(sw).toBeGreaterThanOrEqual(3);
  });

  it('path starts horizontally (cp1y equals y1 within 1 px)', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const path = svg.querySelector('path[stroke-dasharray]');
    expect(path).not.toBeNull();
    // Parse: M x1,y1 C cp1x,cp1y …
    const d = path!.getAttribute('d') ?? '';
    const m = d.match(/M\s*([\d.]+),([\d.]+)\s+C\s*([\d.]+),([\d.]+)/i);
    if (m) {
      const y1 = parseFloat(m[2]);
      const cp1y = parseFloat(m[4]);
      expect(Math.abs(y1 - cp1y)).toBeLessThanOrEqual(1);
    }
  });

  it('arrowhead polygon has appear-after-draw class so it is hidden until the path is complete', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const polygon = svg.querySelector('polygon');
    expect(polygon).not.toBeNull();
    const group = polygon!.closest('g');
    const hasClass = polygon!.classList.contains('appear-after-draw') || (group !== null && group.classList.contains('appear-after-draw'));
    expect(hasClass).toBe(true);
  });

  it('the animated path has NO marker-end (arrowhead is a separate element)', () => {
    render(() => <LoginNudge/>);
    const svg = screen.getByTestId('login-nudge-arrow');
    const path = svg.querySelector('path[stroke-dasharray]');
    expect(path).not.toBeNull();
    // marker-end on the path would drag the head along during the draw animation
    expect(path!.getAttribute('marker-end')).toBeNull();
  });
});
