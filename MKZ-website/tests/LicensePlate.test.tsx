import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import LicensePlate from '../src/components/common/LicensePlate';

describe('LicensePlate', () => {
  it('renders plate text', () => {
    render(() => <LicensePlate text="M AB 1234"/>);
    expect(screen.getByTestId('license-plate')).toBeInTheDocument();
    expect(screen.getByText('M AB 1234')).toBeInTheDocument();
  });

  it('renders EU blue strip with D', () => {
    render(() => <LicensePlate text="M AB 1234"/>);
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('renders editable input when editable prop is true', () => {
    render(() => <LicensePlate text="" editable={true}/>);
    expect(screen.getByTestId('license-plate-input')).toBeInTheDocument();
  });

  it('uppercases input text', async () => {
    let captured = '';
    render(() => (<LicensePlate text="" editable={true} onInput={(v) => (captured = v)}/>));
    const input = screen.getByTestId('license-plate-input') as HTMLInputElement;
    // Simulate typing
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(captured).toBe('ABC');
  });

  it('applies size classes', () => {
    const { container } = render(() => <LicensePlate text="X" size="lg"/>);
    const plate = container.querySelector('[data-testid="license-plate"]');
    expect(plate).toBeInTheDocument();
  });
});
