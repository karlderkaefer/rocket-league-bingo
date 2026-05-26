import { describe, it, expect } from 'vitest';
import { detectBingo } from './bingoDetector';
import type { CellMarks } from '../types';

function emptyMarks(): CellMarks[] {
  return Array.from({ length: 25 }, () => ({ hostMarked: false, guestMarked: false }));
}

describe('detectBingo', () => {
  it('returns empty array when no cells are marked', () => {
    const marks = emptyMarks();
    expect(detectBingo(marks)).toEqual([]);
  });

  it('detects a completed row', () => {
    const marks = emptyMarks();
    // Mark row 0: indices 0-4
    for (let i = 0; i < 5; i++) {
      marks[i]!.hostMarked = true;
    }
    const lines = detectBingo(marks);
    expect(lines).toContainEqual({ type: 'row', index: 0 });
  });

  it('detects a completed column', () => {
    const marks = emptyMarks();
    // Mark column 2: indices 2, 7, 12, 17, 22
    for (let i = 0; i < 5; i++) {
      marks[2 + i * 5]!.guestMarked = true;
    }
    const lines = detectBingo(marks);
    expect(lines).toContainEqual({ type: 'column', index: 2 });
  });

  it('detects diagonal 0 (top-left to bottom-right)', () => {
    const marks = emptyMarks();
    const diag0 = [0, 6, 12, 18, 24];
    for (const i of diag0) {
      marks[i]!.hostMarked = true;
    }
    const lines = detectBingo(marks);
    expect(lines).toContainEqual({ type: 'diagonal', index: 0 });
  });

  it('detects diagonal 1 (top-right to bottom-left)', () => {
    const marks = emptyMarks();
    const diag1 = [4, 8, 12, 16, 20];
    for (const i of diag1) {
      marks[i]!.guestMarked = true;
    }
    const lines = detectBingo(marks);
    expect(lines).toContainEqual({ type: 'diagonal', index: 1 });
  });

  it('detects bingo from union of both players marks', () => {
    const marks = emptyMarks();
    // Row 3: indices 15-19, mixed marks
    marks[15]!.hostMarked = true;
    marks[16]!.guestMarked = true;
    marks[17]!.hostMarked = true;
    marks[18]!.guestMarked = true;
    marks[19]!.hostMarked = true;
    const lines = detectBingo(marks);
    expect(lines).toContainEqual({ type: 'row', index: 3 });
  });

  it('does not detect bingo for incomplete line', () => {
    const marks = emptyMarks();
    // Mark only 4 of 5 cells in row 1
    for (let i = 5; i < 9; i++) {
      marks[i]!.hostMarked = true;
    }
    const lines = detectBingo(marks);
    expect(lines).not.toContainEqual({ type: 'row', index: 1 });
  });

  it('detects multiple bingo lines simultaneously', () => {
    const marks = emptyMarks();
    // Mark row 0 and column 0
    for (let i = 0; i < 5; i++) {
      marks[i]!.hostMarked = true;       // row 0
      marks[i * 5]!.guestMarked = true;  // column 0
    }
    const lines = detectBingo(marks);
    expect(lines).toContainEqual({ type: 'row', index: 0 });
    expect(lines).toContainEqual({ type: 'column', index: 0 });
  });

  it('does not detect bingo when cell is unmarked by both players', () => {
    const marks = emptyMarks();
    // Mark 4 cells in row 2, leave one unmarked
    marks[10]!.hostMarked = true;
    marks[11]!.hostMarked = true;
    marks[12]!.hostMarked = true;
    marks[13]!.hostMarked = true;
    // marks[14] is unmarked
    const lines = detectBingo(marks);
    expect(lines).not.toContainEqual({ type: 'row', index: 2 });
  });
});
