import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { BoardGrid } from './BoardGrid';
import type { Cell } from '@/lib/board-generator';
import type { CellMarks } from '@/lib/bingo-detector';

function makeCells(count = 25): Cell[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `Cell ${i}`,
    categoryId: 'test-category',
    index: i,
  }));
}

function makeMarks(count = 25): CellMarks[] {
  return Array.from({ length: count }, () => ({
    hostMarked: false,
    guestMarked: false,
  }));
}

describe('BoardGrid', () => {
  it('renders exactly 25 cells', () => {
    render(
      <BoardGrid
        cells={makeCells()}
        marks={makeMarks()}
        onCellClick={() => {}}
        myRole="host"
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(25);
  });

  it('has grid role', () => {
    render(
      <BoardGrid
        cells={makeCells()}
        marks={makeMarks()}
        onCellClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('has aria-label "Bingo board"', () => {
    render(
      <BoardGrid
        cells={makeCells()}
        marks={makeMarks()}
        onCellClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Bingo board');
  });

  it('passes correct onCellClick handler with cell index', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <BoardGrid
        cells={makeCells()}
        marks={makeMarks()}
        onCellClick={handleClick}
        myRole="host"
      />,
    );

    const buttons = screen.getAllByRole('button');
    // Click the 4th cell (index 3)
    await user.click(buttons[3]!);
    expect(handleClick).toHaveBeenCalledWith(3);

    // Click the last cell (index 24)
    await user.click(buttons[24]!);
    expect(handleClick).toHaveBeenCalledWith(24);
  });

  it('renders each cell with its text content', () => {
    render(
      <BoardGrid
        cells={makeCells()}
        marks={makeMarks()}
        onCellClick={() => {}}
        myRole="host"
      />,
    );

    expect(screen.getByText('Cell 0')).toBeInTheDocument();
    expect(screen.getByText('Cell 12')).toBeInTheDocument();
    expect(screen.getByText('Cell 24')).toBeInTheDocument();
  });
});
