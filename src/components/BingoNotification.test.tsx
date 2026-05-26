import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BingoNotification from './BingoNotification';
import type { BingoLine } from '../types';

describe('BingoNotification', () => {
  it('renders nothing when bingoLines is empty', () => {
    const { container } = render(<BingoNotification bingoLines={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows notification when bingoLines has one entry', () => {
    const lines: BingoLine[] = [{ type: 'row', index: 0 }];
    render(<BingoNotification bingoLines={lines} />);
    expect(screen.getByRole('alert')).toHaveTextContent('🎉 BINGO! 1 line completed!');
  });

  it('shows notification with plural for multiple bingo lines', () => {
    const lines: BingoLine[] = [
      { type: 'row', index: 0 },
      { type: 'column', index: 2 },
    ];
    render(<BingoNotification bingoLines={lines} />);
    expect(screen.getByRole('alert')).toHaveTextContent('🎉 BINGO! 2 lines completed!');
  });

  it('uses role="alert" for accessibility', () => {
    const lines: BingoLine[] = [{ type: 'diagonal', index: 0 }];
    render(<BingoNotification bingoLines={lines} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('auto-dismisses when bingoLines becomes empty (re-render)', () => {
    const lines: BingoLine[] = [{ type: 'row', index: 1 }];
    const { rerender, container } = render(<BingoNotification bingoLines={lines} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Simulate bingo line broken by unmark
    rerender(<BingoNotification bingoLines={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
