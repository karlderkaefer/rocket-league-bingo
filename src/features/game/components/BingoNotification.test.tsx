import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BingoNotification } from './BingoNotification';
import type { BingoLineWithWinner } from '@/lib/bingo-detector';

describe('BingoNotification', () => {
  it('returns null when bingoLines is empty', () => {
    const { container } = render(<BingoNotification bingoLines={[]} myRole="host" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows BINGO! text when lines exist', () => {
    const lines: BingoLineWithWinner[] = [{ type: 'row', index: 0, winner: 'host' }];
    render(<BingoNotification bingoLines={lines} myRole="host" />);

    expect(screen.getByText(/BINGO!/)).toBeInTheDocument();
  });

  it('shows winner name when host wins', () => {
    const lines: BingoLineWithWinner[] = [{ type: 'row', index: 0, winner: 'host' }];
    render(<BingoNotification bingoLines={lines} myRole="host" />);

    // Default name is "You" when no localStorage name is set
    expect(screen.getByText(/You wins!/)).toBeInTheDocument();
  });

  it('shows "Opponent wins!" when guest wins and myRole is host', () => {
    const lines: BingoLineWithWinner[] = [{ type: 'row', index: 0, winner: 'guest' }];
    render(<BingoNotification bingoLines={lines} myRole="host" />);

    expect(screen.getByText(/Opponent wins!/)).toBeInTheDocument();
  });

  it('shows "Both players win!" for cooperative completion', () => {
    const lines: BingoLineWithWinner[] = [{ type: 'row', index: 0, winner: 'both' }];
    render(<BingoNotification bingoLines={lines} myRole="host" />);

    expect(screen.getByText(/Both players win!/)).toBeInTheDocument();
  });

  it('shows line description', () => {
    const lines: BingoLineWithWinner[] = [{ type: 'column', index: 2, winner: 'host' }];
    render(<BingoNotification bingoLines={lines} myRole="host" />);

    expect(screen.getByText(/Column 3/)).toBeInTheDocument();
  });

  it('has role=alert for accessibility', () => {
    const lines: BingoLineWithWinner[] = [{ type: 'row', index: 4, winner: 'guest' }];
    render(<BingoNotification bingoLines={lines} myRole="host" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
