import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ProfileStack from '../src/components/common/ProfileStack';

describe('ProfileStack', () => {
  it('renders up to maxVisible avatars', () => {
    const players = [
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Charlie' },
      { name: 'Dave' },
      { name: 'Eve' },
    ];
    render(() => <ProfileStack players={players} maxVisible={3} />);
    const avatars = screen.getAllByTestId('profile-avatar');
    expect(avatars.length).toBe(3);
  });

  it('shows +N counter for remaining', () => {
    const players = [
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Charlie' },
      { name: 'Dave' },
      { name: 'Eve' },
    ];
    render(() => <ProfileStack players={players} maxVisible={3} />);
    expect(screen.getByTestId('profile-stack-remaining')).toHaveTextContent('+2');
  });

  it('does not show counter when all visible', () => {
    const players = [{ name: 'Alice' }, { name: 'Bob' }];
    render(() => <ProfileStack players={players} maxVisible={3} />);
    expect(screen.queryByTestId('profile-stack-remaining')).toBeNull();
  });

  it('handles empty list', () => {
    render(() => <ProfileStack players={[]} />);
    expect(screen.queryByTestId('profile-avatar')).toBeNull();
  });
});
