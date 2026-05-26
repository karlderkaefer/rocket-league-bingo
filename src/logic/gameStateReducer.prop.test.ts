import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { gameStateReducer, initialGameState } from './gameStateReducer';
import type { GameState, CellMarks, PlayerRole } from '../types';

// Custom generators
const playerRoleArb = fc.constantFrom('host', 'guest') as fc.Arbitrary<PlayerRole>;
const cellIndexArb = fc.nat({ max: 24 });
const marksArb = fc.array(
  fc.record({ hostMarked: fc.boolean(), guestMarked: fc.boolean() }),
  { minLength: 25, maxLength: 25 }
);

function buildState(marks: CellMarks[]): GameState {
  return { ...initialGameState, marks };
}

describe('gameStateReducer property tests', () => {
  /**
   * Property 4: Mark/unmark preserves other player's marks
   *
   * For any marks state, cell index, and player, marking/unmarking by that player
   * should not change the other player's mark on that cell.
   *
   * **Validates: Requirements 5.1, 5.3, 5.5**
   */
  describe('Property 4: Mark/unmark preserves other player marks', () => {
    test.prop(
      { marks: marksArb, cellIndex: cellIndexArb, player: playerRoleArb },
      { numRuns: 100 }
    )(
      'marking a cell does not affect the other player mark on that cell',
      ({ marks, cellIndex, player }) => {
        const state = buildState(marks);
        const otherKey: keyof CellMarks = player === 'host' ? 'guestMarked' : 'hostMarked';
        const originalOtherMark = state.marks[cellIndex]![otherKey];

        const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex, player });

        expect(result.marks[cellIndex]![otherKey]).toBe(originalOtherMark);
      }
    );

    test.prop(
      { marks: marksArb, cellIndex: cellIndexArb, player: playerRoleArb },
      { numRuns: 100 }
    )(
      'unmarking a cell does not affect the other player mark on that cell',
      ({ marks, cellIndex, player }) => {
        const state = buildState(marks);
        const otherKey: keyof CellMarks = player === 'host' ? 'guestMarked' : 'hostMarked';
        const originalOtherMark = state.marks[cellIndex]![otherKey];

        const result = gameStateReducer(state, { type: 'UNMARK_CELL', cellIndex, player });

        expect(result.marks[cellIndex]![otherKey]).toBe(originalOtherMark);
      }
    );

    test.prop(
      { marks: marksArb, cellIndex: cellIndexArb, player: playerRoleArb },
      { numRuns: 100 }
    )(
      'marking a cell does not affect any other cell marks',
      ({ marks, cellIndex, player }) => {
        const state = buildState(marks);
        const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex, player });

        for (let i = 0; i < 25; i++) {
          if (i !== cellIndex) {
            expect(result.marks[i]!.hostMarked).toBe(state.marks[i]!.hostMarked);
            expect(result.marks[i]!.guestMarked).toBe(state.marks[i]!.guestMarked);
          }
        }
      }
    );

    test.prop(
      { marks: marksArb, cellIndex: cellIndexArb, player: playerRoleArb },
      { numRuns: 100 }
    )(
      'unmarking a cell does not affect any other cell marks',
      ({ marks, cellIndex, player }) => {
        const state = buildState(marks);
        const result = gameStateReducer(state, { type: 'UNMARK_CELL', cellIndex, player });

        for (let i = 0; i < 25; i++) {
          if (i !== cellIndex) {
            expect(result.marks[i]!.hostMarked).toBe(state.marks[i]!.hostMarked);
            expect(result.marks[i]!.guestMarked).toBe(state.marks[i]!.guestMarked);
          }
        }
      }
    );
  });

  /**
   * Property 5: Mark and unmark actions are idempotent
   *
   * For any state and action, applying the same MARK_CELL or UNMARK_CELL action
   * twice should produce the same result as applying it once.
   *
   * **Validates: Requirements 7.5**
   */
  describe('Property 5: Mark and unmark actions are idempotent', () => {
    test.prop(
      { marks: marksArb, cellIndex: cellIndexArb, player: playerRoleArb },
      { numRuns: 100 }
    )(
      'applying MARK_CELL twice produces same state as applying it once',
      ({ marks, cellIndex, player }) => {
        const state = buildState(marks);
        const afterFirst = gameStateReducer(state, { type: 'MARK_CELL', cellIndex, player });
        const afterSecond = gameStateReducer(afterFirst, { type: 'MARK_CELL', cellIndex, player });

        expect(afterSecond.marks).toEqual(afterFirst.marks);
      }
    );

    test.prop(
      { marks: marksArb, cellIndex: cellIndexArb, player: playerRoleArb },
      { numRuns: 100 }
    )(
      'applying UNMARK_CELL twice produces same state as applying it once',
      ({ marks, cellIndex, player }) => {
        const state = buildState(marks);
        const afterFirst = gameStateReducer(state, { type: 'UNMARK_CELL', cellIndex, player });
        const afterSecond = gameStateReducer(afterFirst, { type: 'UNMARK_CELL', cellIndex, player });

        expect(afterSecond.marks).toEqual(afterFirst.marks);
      }
    );
  });
});
