import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import ChallengesGrid from '../src/components/features/ChallengesGrid';

describe('ChallengesGrid', () => {
  it('renders the challenges section', () => {
    render(() => <ChallengesGrid />);
    expect(screen.getByTestId('challenges-grid')).toBeInTheDocument();
    expect(screen.getByText('Your Challenges')).toBeInTheDocument();
  });

  it('renders challenge cards', () => {
    render(() => <ChallengesGrid />);
    const cards = screen.getAllByTestId('challenge-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('shows challenge names', () => {
    render(() => <ChallengesGrid />);
    expect(screen.getByText('Germany / Regions')).toBeInTheDocument();
    expect(screen.getByText('Rarest Plate of the Week')).toBeInTheDocument();
  });

  it('shows progress previews', () => {
    render(() => <ChallengesGrid />);
    const previews = screen.getAllByTestId('progress-preview');
    expect(previews.length).toBeGreaterThan(0);
  });

  it('expands challenge on click', async () => {
    render(() => <ChallengesGrid />);
    const cards = screen.getAllByTestId('challenge-card');
    await fireEvent.click(cards[0].querySelector('button')!);
    expect(screen.getByTestId('challenge-expanded')).toBeInTheDocument();
  });

  it('collapses challenge on second click', async () => {
    render(() => <ChallengesGrid />);
    const cards = screen.getAllByTestId('challenge-card');
    await fireEvent.click(cards[0].querySelector('button')!);
    expect(screen.getByTestId('challenge-expanded')).toBeInTheDocument();
    await fireEvent.click(cards[0].querySelector('button')!);
    expect(screen.queryByTestId('challenge-expanded')).toBeNull();
  });

  it('shows profile stacks with participant count', () => {
    render(() => <ChallengesGrid />);
    const stacks = screen.getAllByTestId('profile-stack');
    expect(stacks.length).toBeGreaterThan(0);
  });
});
