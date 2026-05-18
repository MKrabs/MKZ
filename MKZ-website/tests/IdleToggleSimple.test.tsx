import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import TitleBar from '../src/components/layout/TitleBar';

describe('Idle toggle simple', () => {
  it('renders TitleBar', () => {
    const { getByTestId } = render(() => <TitleBar />);
    const btn = getByTestId('sign-in-btn');
    expect(btn).toBeInTheDocument();
  });
});
