import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { detectBingo } from './bingoDetector';
import type { BingoLine } from '../types';

/**
 * Property 6: Bingo detection correctness
 * Property 7: Unmarking a cell in a bingo line removes that bingo
 * Validates: Requirements 6.1, 6.3, 6.5
 */

// Custom generator: 25 cell marks (one per cell on the 5x5 board)
const marksArb = fc.array(
  fc.record({ hostMarked: fc.boolean(), guestMarked: fc.boolean() }),
  { minLength: 25, maxLength: 25 }
);

// Helper to get the 5 cell indices for a given bingo line
function getLineIndices(line: BingoLine): number[] {
  if (line.type === 'row') return [0, 1, 2, 3, 4].map((c) => line.index * 5 + c);
  if (line.type === 'column') return [0, 1, 2, 3, 4].map((r) => r * 5 + line.index);
  if (line.index === 0) return [0, 6, 12, 18, 24];
  return [4, 8, 12, 16, 20];
}

// All possible bingo lines on a 5x5 board
const ALL_LINES: BingoLine[] = [
  ...([0, 1, 2, 3, 4].map((i) => ({ type: 'row' as const, index: i }))),
  ...([0, 1, 2, 3, 4].map((i) => ({ type: 'column' as const, index: i }))),
  { type: 'diagonal', index: 0 },
  { type: 'diagonal', index: 1 },
];

describe('Property 6: Bingo detection correctness', () => {
  test.prop([marksArb], { numRuns: 100 })(
    'every detected bingo line has all 5 cells marked (union of both players)',
    (marks) => {
      const detectedLines = detectBingo(marks);
      for (const line of detectedLines) {
        const indices = getLineIndices(line);
        for (const i of indices) {
          expect(marks[i]!.hostMarked || marks[i]!.guestMarked).toBe(true);
        }
      }
    }
  );

  test.prop([marksArb], { numRuns: 100 })(
    'every complete line is detected as a bingo',
    (marks) => {
      const detectedLines = detectBingo(marks);

      // Check all possible lines: if a line is complete, it must be detected
      for (const line of ALL_LINES) {
        const indices = getLineIndices(line);
        const isComplete = indices.every(
          (i) => marks[i]!.hostMarked || marks[i]!.guestMarked
        );
        const isDetected = detectedLines.some(
          (d) => d.type === line.type && d.index === line.index
        );
        expect(isDetected).toBe(isComplete);
      }
    }
  );
});

describe('Property 7: Unmarking a cell in a bingo line removes that bingo', () => {
  // Generator: marks that guarantee at least one bingo line exists.
  // We force a specific line to be complete, then randomize the rest.
  const marksWithBingoArb = fc
    .tuple(
      fc.constantFrom(...ALL_LINES),
      marksArb
    )
    .map(([forcedLine, baseMarks]) => {
      const marks = baseMarks.map((m) => ({ ...m }));
      // Force all cells in the chosen line to be marked
      const indices = getLineIndices(forcedLine);
      for (const i of indices) {
        // At least one player marks it
        if (!marks[i]!.hostMarked && !marks[i]!.guestMarked) {
          marks[i]!.hostMarked = true;
        }
      }
      return { marks, forcedLine };
    });

  test.prop([marksWithBingoArb, fc.integer({ min: 0, max: 4 })], { numRuns: 100 })(
    'unmarking all players from a cell in a bingo line removes that bingo',
    ({ marks, forcedLine }, cellPositionInLine) => {
      // Verify the forced line is indeed detected
      const linesBefore = detectBingo(marks);
      const isDetectedBefore = linesBefore.some(
        (d) => d.type === forcedLine.type && d.index === forcedLine.index
      );
      expect(isDetectedBefore).toBe(true);

      // Unmark one cell in the forced line (set both players to false)
      const indices = getLineIndices(forcedLine);
      const cellToUnmark = indices[cellPositionInLine]!;
      const modifiedMarks = marks.map((m) => ({ ...m }));
      modifiedMarks[cellToUnmark] = { hostMarked: false, guestMarked: false };

      // That specific line should no longer be detected
      const linesAfter = detectBingo(modifiedMarks);
      const isDetectedAfter = linesAfter.some(
        (d) => d.type === forcedLine.type && d.index === forcedLine.index
      );
      expect(isDetectedAfter).toBe(false);
    }
  );
});
