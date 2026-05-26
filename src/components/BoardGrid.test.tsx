import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BoardGrid from './BoardGrid';
import BingoCell from './BingoCell';
import type { Cell, CellMarks, BingoLine } from '../types';

// Helper to create a 25-cell board
function makeCells(): Cell[] {
  return Array.from({ length: 25 }, (_, i) => ({
    index: i,
    text: `Item ${i}`,
    categoryId: 'cat-1',
  }));
}

// Helper to create default (unmarked) marks
function makeUnmarkedMarks(): CellMarks[] {
  return Array.from({ length: 25 }, () => ({
    hostMarked: false,
    guestMarked: false,
  }));
}

describe('BoardGrid', () => {
  it('renders a 5×5 grid with 25 cells', () => {
    const cells = makeCells();
    const marks = makeUnmarkedMarks();
    const onCellClick = vi.fn();

    render(
      <BoardGrid
        cells={cells}
        marks={marks}
        bingoLines={[]}
        myRole="host"
        onCellClick={onCellClick}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(25);
  });

  it('renders cell text content', () => {
    const cells = makeCells();
    const marks = makeUnmarkedMarks();
    const onCellClick = vi.fn();

    render(
      <BoardGrid
        cells={cells}
        marks={marks}
        bingoLines={[]}
        myRole="host"
        onCellClick={onCellClick}
      />
    );

    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 12')).toBeInTheDocument();
    expect(screen.getByText('Item 24')).toBeInTheDocument();
  });

  it('calls onCellClick with the correct cell index', () => {
    const cells = makeCells();
    const marks = makeUnmarkedMarks();
    const onCellClick = vi.fn();

    render(
      <BoardGrid
        cells={cells}
        marks={marks}
        bingoLines={[]}
        myRole="host"
        onCellClick={onCellClick}
      />
    );

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[7]);
    expect(onCellClick).toHaveBeenCalledWith(7);
  });

  it('highlights cells that are part of a bingo line', () => {
    const cells = makeCells();
    const marks = makeUnmarkedMarks();
    // Mark entire first row
    for (let i = 0; i < 5; i++) {
      marks[i] = { hostMarked: true, guestMarked: false };
    }
    const bingoLines: BingoLine[] = [{ type: 'row', index: 0 }];
    const onCellClick = vi.fn();

    const { container } = render(
      <BoardGrid
        cells={cells}
        marks={marks}
        bingoLines={bingoLines}
        myRole="host"
        onCellClick={onCellClick}
      />
    );

    const buttons = container.querySelectorAll('button');
    // First 5 cells should have the bingo-line class
    for (let i = 0; i < 5; i++) {
      expect(buttons[i].className).toContain('bingoCellBingoLine');
    }
    // Cell 5 should NOT have the bingo-line class
    expect(buttons[5].className).not.toContain('bingoCellBingoLine');
  });

  it('highlights diagonal bingo line cells correctly', () => {
    const cells = makeCells();
    const marks = makeUnmarkedMarks();
    // Mark diagonal 0: indices 0, 6, 12, 18, 24
    const diagIndices = [0, 6, 12, 18, 24];
    for (const idx of diagIndices) {
      marks[idx] = { hostMarked: true, guestMarked: false };
    }
    const bingoLines: BingoLine[] = [{ type: 'diagonal', index: 0 }];
    const onCellClick = vi.fn();

    const { container } = render(
      <BoardGrid
        cells={cells}
        marks={marks}
        bingoLines={bingoLines}
        myRole="host"
        onCellClick={onCellClick}
      />
    );

    const buttons = container.querySelectorAll('button');
    for (const idx of diagIndices) {
      expect(buttons[idx].className).toContain('bingoCellBingoLine');
    }
    // Non-diagonal cell should not be highlighted
    expect(buttons[1].className).not.toContain('bingoCellBingoLine');
  });
});

describe('BingoCell', () => {
  const baseCell: Cell = { index: 0, text: 'Test Item', categoryId: 'cat-1' };

  it('renders unmarked state', () => {
    const marks: CellMarks = { hostMarked: false, guestMarked: false };
    const onClick = vi.fn();

    const { container } = render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={false}
        onClick={onClick}
      />
    );

    const button = container.querySelector('button')!;
    expect(button.className).toContain('bingoCellUnmarked');
    expect(button.className).not.toContain('bingoCellMarkedHost');
    expect(button.className).not.toContain('bingoCellMarkedGuest');
    expect(button.className).not.toContain('bingoCellMarkedBoth');
  });

  it('renders marked-by-host state', () => {
    const marks: CellMarks = { hostMarked: true, guestMarked: false };
    const onClick = vi.fn();

    const { container } = render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={true}
        onClick={onClick}
      />
    );

    const button = container.querySelector('button')!;
    expect(button.className).toContain('bingoCellMarkedHost');
  });

  it('renders marked-by-guest state', () => {
    const marks: CellMarks = { hostMarked: false, guestMarked: true };
    const onClick = vi.fn();

    const { container } = render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={false}
        onClick={onClick}
      />
    );

    const button = container.querySelector('button')!;
    expect(button.className).toContain('bingoCellMarkedGuest');
  });

  it('renders marked-by-both state', () => {
    const marks: CellMarks = { hostMarked: true, guestMarked: true };
    const onClick = vi.fn();

    const { container } = render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={true}
        onClick={onClick}
      />
    );

    const button = container.querySelector('button')!;
    expect(button.className).toContain('bingoCellMarkedBoth');
  });

  it('applies bingo-line class when cell is in a bingo line', () => {
    const marks: CellMarks = { hostMarked: true, guestMarked: false };
    const onClick = vi.fn();

    const { container } = render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={true}
        isMarkedByMe={true}
        onClick={onClick}
      />
    );

    const button = container.querySelector('button')!;
    expect(button.className).toContain('bingoCellBingoLine');
  });

  it('does not apply bingo-line class when cell is not in a bingo line', () => {
    const marks: CellMarks = { hostMarked: true, guestMarked: false };
    const onClick = vi.fn();

    const { container } = render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={true}
        onClick={onClick}
      />
    );

    const button = container.querySelector('button')!;
    expect(button.className).not.toContain('bingoCellBingoLine');
  });

  it('calls onClick when clicked', () => {
    const marks: CellMarks = { hostMarked: false, guestMarked: false };
    const onClick = vi.fn();

    render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={false}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has correct aria-pressed attribute', () => {
    const marks: CellMarks = { hostMarked: true, guestMarked: false };
    const onClick = vi.fn();

    render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={true}
        onClick={onClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('has correct aria-label with marked status', () => {
    const marks: CellMarks = { hostMarked: true, guestMarked: false };
    const onClick = vi.fn();

    render(
      <BingoCell
        cell={baseCell}
        marks={marks}
        isInBingoLine={false}
        isMarkedByMe={true}
        onClick={onClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Test Item, marked');
  });
});
