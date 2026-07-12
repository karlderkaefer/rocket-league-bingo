import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { detectBingo, type CellMarks } from './bingo-detector';

/**
 * Property-based tests for the bingo-detector module.
 * Tests bingo detection correctness and unmark-reduces-lines properties.
 */

// Generators
const marksArbitrary = fc.array(
  fc.record({ hostMarked: fc.boolean(), guestMarked: fc.boolean() }),
  { minLength: 25, maxLength: 25 },
);

// All 12 lines on the 5×5 board
const ALL_LINES: { type: 'row' | 'column' | 'diagonal'; index: number; cells: number[] }[] = [
  // 5 rows
  { type: 'row', index: 0, cells: [0, 1, 2, 3, 4] },
  { type: 'row', index: 1, cells: [5, 6, 7, 8, 9] },
  { type: 'row', index: 2, cells: [10, 11, 12, 13, 14] },
  { type: 'row', index: 3, cells: [15, 16, 17, 18, 19] },
  { type: 'row', index: 4, cells: [20, 21, 22, 23, 24] },
  // 5 columns
  { type: 'column', index: 0, cells: [0, 5, 10, 15, 20] },
  { type: 'column', index: 1, cells: [1, 6, 11, 16, 21] },
  { type: 'column', index: 2, cells: [2, 7, 12, 17, 22] },
  { type: 'column', index: 3, cells: [3, 8, 13, 18, 23] },
  { type: 'column', index: 4, cells: [4, 9, 14, 19, 24] },
  // 2 diagonals
  { type: 'diagonal', index: 0, cells: [0, 6, 12, 18, 24] },
  { type: 'diagonal', index: 1, cells: [4, 8, 12, 16, 20] },
];

/** Check if a cell is marked (by either player) */
function isCellMarked(cell: CellMarks): boolean {
  return cell.hostMarked || cell.guestMarked;
}

/** Check if a line is complete given a marks array */
function isLineComplete(marks: CellMarks[], cells: number[]): boolean {
  return cells.every((i) => {
    const cell = marks[i];
    return cell !== undefined && isCellMarked(cell);
  });
}

describe('bingo-detector property tests', () => {
  /**
   * Property 6: Bingo detection correctness
   *
   * For any 25-element marks array, detectBingo reports a line as complete
   * if and only if all 5 cells in that line have hostMarked OR guestMarked true.
   * The function checks all 12 possible lines (5 rows, 5 columns, 2 diagonals).
   *
   * **Validates: Requirements 7.1, 7.3**
   */
  test.prop([marksArbitrary], { numRuns: 200 })(
    'detectBingo reports line complete iff all 5 cells are marked',
    (marks: CellMarks[]) => {
      const result = detectBingo(marks);

      // For each of the 12 lines, verify correctness
      for (const line of ALL_LINES) {
        const shouldBeComplete = isLineComplete(marks, line.cells);
        const isDetected = result.some(
          (r) => r.type === line.type && r.index === line.index,
        );

        expect(isDetected).toBe(shouldBeComplete);
      }

      // Result should only contain valid lines (no extras)
      expect(result.length).toBeLessThanOrEqual(12);

      // Every reported line should have all 5 cells marked
      for (const detected of result) {
        const lineDef = ALL_LINES.find(
          (l) => l.type === detected.type && l.index === detected.index,
        );
        expect(lineDef).toBeDefined();
        if (lineDef) {
          expect(isLineComplete(marks, lineDef.cells)).toBe(true);
        }
      }
    },
  );

  /**
   * Property 7: Unmarking can only reduce bingo lines
   *
   * Given marks with at least one bingo line, if a cell in a complete line
   * is unmarked such that it becomes completely unmarked (both false),
   * the number of detected bingo lines should decrease or stay the same.
   *
   * **Validates: Requirements 7.5, 7.6**
   */
  test.prop([marksArbitrary], { numRuns: 200 })(
    'unmarking a cell in a complete line reduces or maintains bingo count',
    (marks: CellMarks[]) => {
      const beforeLines = detectBingo(marks);

      // Skip if no bingo lines detected — nothing to unmark from
      if (beforeLines.length === 0) return;

      // Pick a line that is complete
      const completeLine = beforeLines[0]!;
      const lineDef = ALL_LINES.find(
        (l) => l.type === completeLine.type && l.index === completeLine.index,
      )!;

      // Find a cell in this line that is marked
      const markedCellIndex = lineDef.cells.find((i) => {
        const cell = marks[i];
        return cell !== undefined && isCellMarked(cell);
      });
      // All cells must be marked since the line is complete, so this always succeeds
      expect(markedCellIndex).toBeDefined();

      if (markedCellIndex === undefined) return;

      // Fully unmark the cell (set both to false)
      const afterMarks: CellMarks[] = marks.map((cell, i) =>
        i === markedCellIndex
          ? { hostMarked: false, guestMarked: false }
          : { ...cell },
      );

      const afterLines = detectBingo(afterMarks);

      // Bingo line count should decrease or stay the same
      expect(afterLines.length).toBeLessThanOrEqual(beforeLines.length);

      // The specific line we broke should no longer be detected
      const brokenLineStillDetected = afterLines.some(
        (r) => r.type === completeLine.type && r.index === completeLine.index,
      );
      expect(brokenLineStillDetected).toBe(false);
    },
  );
});
