import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import Button from '../src/components/common/Button';

describe('Button', () => {
  it('renders children text', () => {
    render(() => <Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(() => <Button loading={true}>Submit</Button>);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).toBeNull();
  });

  it('is disabled when loading', () => {
    render(() => <Button loading={true}>Submit</Button>);
    expect(screen.getByTestId('button')).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(() => <Button disabled={true}>Submit</Button>);
    expect(screen.getByTestId('button')).toBeDisabled();
  });

  it('calls onClick when clicked', async () => {
    let clicked = false;
    render(() => <Button onClick={() => (clicked = true)}>Click</Button>);
    await fireEvent.click(screen.getByTestId('button'));
    expect(clicked).toBe(true);
  });
});
