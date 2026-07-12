import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShareCodePanel } from './ShareCodePanel';

describe('ShareCodePanel', () => {
  const defaultProps = {
    shareCode: 'XYZ789ab',
    shareUrl: 'https://username.github.io/rocket-league-bingo/#/join/XYZ789ab',
  };

  it('displays the share code prominently', () => {
    render(<ShareCodePanel {...defaultProps} />);

    expect(screen.getByLabelText('Share code')).toHaveTextContent('XYZ789ab');
  });

  it('displays the full share URL', () => {
    render(<ShareCodePanel {...defaultProps} />);

    expect(
      screen.getByText('https://username.github.io/rocket-league-bingo/#/join/XYZ789ab')
    ).toBeInTheDocument();
  });

  it('shows a copy button', () => {
    render(<ShareCodePanel {...defaultProps} />);

    expect(screen.getByRole('button', { name: /copy share url/i })).toBeInTheDocument();
  });

  it('copies the share URL to clipboard on button click', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(<ShareCodePanel {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /copy share url/i }));

    expect(mockWriteText).toHaveBeenCalledWith(defaultProps.shareUrl);
  });

  it('shows "Copied!" text after successful copy', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(<ShareCodePanel {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /copy share url/i }));

    // Wait for state update
    await screen.findByText('Copied!');
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('shows heading indicating to share with opponent', () => {
    render(<ShareCodePanel {...defaultProps} />);

    expect(
      screen.getByText(/share this code with your opponent/i)
    ).toBeInTheDocument();
  });
});
