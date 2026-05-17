import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ProfileAvatar from '../src/components/common/ProfileAvatar';

describe('ProfileAvatar', () => {
  it('renders initials when no image', () => {
    render(() => <ProfileAvatar name="Max Müller" />);
    expect(screen.getByText('MM')).toBeInTheDocument();
  });

  it('renders single initial for single name', () => {
    render(() => <ProfileAvatar name="Alice" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders image when imageUrl provided', () => {
    render(() => <ProfileAvatar name="Max" imageUrl="https://example.com/avatar.jpg" />);
    const img = screen.getByAltText('Max');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('shows title with name', () => {
    render(() => <ProfileAvatar name="Max" />);
    expect(screen.getByTestId('profile-avatar')).toHaveAttribute('title', 'Max');
  });
});
