import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BingoCell } from './BingoCell';
import type { Cell } from '@/lib/board-generator';
// CellMarks type available from @/lib/bingo-detector if needed

function makeCell(overrides: Partial<Cell> = {}): Cell {
  return { text: 'Aerial Goal', categoryId: 'shot-types', index: 0, ...overrides };
}

describe('BingoCell', () => {
  it('renders cell text', () => {
    render(
      <BingoCell
        cell={makeCell({ text: 'Hat Trick' })}
        marks={{ hostMarked: false, guestMarked: false }}
        onClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByText('Hat Trick')).toBeInTheDocument();
  });

  it('shows correct aria-label when unmarked', () => {
    render(
      <BingoCell
        cell={makeCell({ text: 'Aerial Goal' })}
        marks={{ hostMarked: false, guestMarked: false }}
        onClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Aerial Goal, unmarked. Click to mark',
    );
  });

  it('shows correct aria-label when marked by host only', () => {
    render(
      <BingoCell
        cell={makeCell({ text: 'Aerial Goal' })}
        marks={{ hostMarked: true, guestMarked: false }}
        onClick={() => {}}
        myRole="guest"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Aerial Goal, marked by host. Click to mark',
    );
  });

  it('shows correct aria-label when marked by guest only', () => {
    render(
      <BingoCell
        cell={makeCell({ text: 'Aerial Goal' })}
        marks={{ hostMarked: false, guestMarked: true }}
        onClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Aerial Goal, marked by guest. Click to mark',
    );
  });

  it('shows correct aria-label when marked by both', () => {
    render(
      <BingoCell
        cell={makeCell({ text: 'Aerial Goal' })}
        marks={{ hostMarked: true, guestMarked: true }}
        onClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Aerial Goal, marked by both players. Click to unmark',
    );
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <BingoCell
        cell={makeCell()}
        marks={{ hostMarked: false, guestMarked: false }}
        onClick={handleClick}
        myRole="host"
      />,
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has aria-pressed=false when not marked by myRole (host)', () => {
    render(
      <BingoCell
        cell={makeCell()}
        marks={{ hostMarked: false, guestMarked: true }}
        onClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('has aria-pressed=true when marked by myRole (host)', () => {
    render(
      <BingoCell
        cell={makeCell()}
        marks={{ hostMarked: true, guestMarked: false }}
        onClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-pressed=true when marked by myRole (guest)', () => {
    render(
      <BingoCell
        cell={makeCell()}
        marks={{ hostMarked: false, guestMarked: true }}
        onClick={() => {}}
        myRole="guest"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-pressed=false when marked only by other player (guest viewing host mark)', () => {
    render(
      <BingoCell
        cell={makeCell()}
        marks={{ hostMarked: true, guestMarked: false }}
        onClick={() => {}}
        myRole="guest"
      />,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
