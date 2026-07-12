import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import {
  gameReducer,
  createInitialState,
  type PlayerRole,
} from './reducer';
import type { CellMarks } from '@/lib/bingo-detector';

/**
 * Property-based tests for the game state reducer.
 * Tests mark/unmark preservation of other player's marks and idempotency.
 */

// Generators
const marksArbitrary = fc.array(
  fc.record({ hostMarked: fc.boolean(), guestMarked: fc.boolean() }),
  { minLength: 25, maxLength: 25 },
) as fc.Arbitrary<CellMarks[]>;

const cellIndexArbitrary = fc.nat({ max: 24 });

const playerRoleArbitrary = fc.constantFrom('host', 'guest') as fc.Arbitrary<PlayerRole>;

describe('game reducer property tests', () => {
  /**
   * Property 4: Mark/unmark preserves other player's marks
   *
   * For any board mark state, any cell index, and any player role:
   * - Marking a cell by one player does not change the other player's mark on that cell.
   * - Marking a cell by one player does not change any other cell's marks.
   *
   * **Validates: Requirements 6.1, 6.5**
   */
  test.prop([marksArbitrary, cellIndexArbitrary, playerRoleArbitrary], { numRuns: 200 })(
    'MARK_CELL preserves other player marks and other cells',
    (marks, cellIndex, player) => {
      const state = createInitialState({ marks });
      const otherPlayer: PlayerRole = player === 'host' ? 'guest' : 'host';

      const result = gameReducer(state, {
        type: 'MARK_CELL',
        cellIndex,
        player,
      });

      // The other player's mark on the target cell is unchanged
      const otherMarkBefore = player === 'host'
        ? marks[cellIndex]!.guestMarked
        : marks[cellIndex]!.hostMarked;
      const otherMarkAfter = otherPlayer === 'guest'
        ? result.marks[cellIndex]!.guestMarked
        : result.marks[cellIndex]!.hostMarked;

      expect(otherMarkAfter).toBe(otherMarkBefore);

      // All other cells are completely unchanged
      for (let i = 0; i < 25; i++) {
        if (i === cellIndex) continue;
        expect(result.marks[i]!.hostMarked).toBe(marks[i]!.hostMarked);
        expect(result.marks[i]!.guestMarked).toBe(marks[i]!.guestMarked);
      }
    },
  );

  test.prop([marksArbitrary, cellIndexArbitrary, playerRoleArbitrary], { numRuns: 200 })(
    'UNMARK_CELL preserves other player marks and other cells',
    (marks, cellIndex, player) => {
      const state = createInitialState({ marks });
      const otherPlayer: PlayerRole = player === 'host' ? 'guest' : 'host';

      const result = gameReducer(state, {
        type: 'UNMARK_CELL',
        cellIndex,
        player,
      });

      // The other player's mark on the target cell is unchanged
      const otherMarkBefore = player === 'host'
        ? marks[cellIndex]!.guestMarked
        : marks[cellIndex]!.hostMarked;
      const otherMarkAfter = otherPlayer === 'guest'
        ? result.marks[cellIndex]!.guestMarked
        : result.marks[cellIndex]!.hostMarked;

      expect(otherMarkAfter).toBe(otherMarkBefore);

      // All other cells are completely unchanged
      for (let i = 0; i < 25; i++) {
        if (i === cellIndex) continue;
        expect(result.marks[i]!.hostMarked).toBe(marks[i]!.hostMarked);
        expect(result.marks[i]!.guestMarked).toBe(marks[i]!.guestMarked);
      }
    },
  );

  /**
   * Property 5: Mark and unmark actions are idempotent
   *
   * Re-marking an already-marked cell or un-marking an unmarked cell
   * produces the same state (no-op).
   *
   * **Validates: Requirements 8.5**
   */
  test.prop([marksArbitrary, cellIndexArbitrary, playerRoleArbitrary], { numRuns: 200 })(
    'MARK_CELL is idempotent — marking an already-marked cell is a no-op',
    (marks, cellIndex, player) => {
      // Pre-condition: the cell is already marked by this player
      const preMarked = marks.map((cell, i) => {
        if (i !== cellIndex) return cell;
        return player === 'host'
          ? { ...cell, hostMarked: true }
          : { ...cell, guestMarked: true };
      }) as CellMarks[];

      const state = createInitialState({ marks: preMarked });

      const result = gameReducer(state, {
        type: 'MARK_CELL',
        cellIndex,
        player,
      });

      // State should be identical (marks unchanged)
      for (let i = 0; i < 25; i++) {
        expect(result.marks[i]!.hostMarked).toBe(preMarked[i]!.hostMarked);
        expect(result.marks[i]!.guestMarked).toBe(preMarked[i]!.guestMarked);
      }
    },
  );

  test.prop([marksArbitrary, cellIndexArbitrary, playerRoleArbitrary], { numRuns: 200 })(
    'UNMARK_CELL is idempotent — unmarking an already-unmarked cell is a no-op',
    (marks, cellIndex, player) => {
      // Pre-condition: the cell is already unmarked by this player
      const preUnmarked = marks.map((cell, i) => {
        if (i !== cellIndex) return cell;
        return player === 'host'
          ? { ...cell, hostMarked: false }
          : { ...cell, guestMarked: false };
      }) as CellMarks[];

      const state = createInitialState({ marks: preUnmarked });

      const result = gameReducer(state, {
        type: 'UNMARK_CELL',
        cellIndex,
        player,
      });

      // State should be identical (marks unchanged)
      for (let i = 0; i < 25; i++) {
        expect(result.marks[i]!.hostMarked).toBe(preUnmarked[i]!.hostMarked);
        expect(result.marks[i]!.guestMarked).toBe(preUnmarked[i]!.guestMarked);
      }
    },
  );
});
