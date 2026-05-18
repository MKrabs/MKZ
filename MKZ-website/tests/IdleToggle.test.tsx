import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import TitleBar from '../src/components/layout/TitleBar';
import * as idleStore from '../src/store/idle';

beforeEach(() => {
  // reset localStorage
  localStorage.clear();
});

describe('Idle toggle in TitleBar', () => {
  it('renders idle toggle and toggles state', async () => {
    const { getByTestId } = render(() => <TitleBar />);
    const toggle = getByTestId('idle-toggle');
    expect(toggle).toBeInTheDocument();

    // initial should be enabled (true)
    expect(idleStore.idleEnabled()).toBe(true);

    // click to disable
    await fireEvent.click(toggle);
    expect(idleStore.idleEnabled()).toBe(false);

    // click to enable
    await fireEvent.click(toggle);
    expect(idleStore.idleEnabled()).toBe(true);
  });
});
