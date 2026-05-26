import { describe, it, expect } from 'vitest';
import { gameStateReducer, initialGameState } from './gameStateReducer';
import type { GameState, Board } from '../types';

describe('gameStateReducer', () => {
  describe('MARK_CELL', () => {
    it('marks a cell for the host player', () => {
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex: 0, player: 'host' });
      expect(result.marks[0]!.hostMarked).toBe(true);
      expect(result.marks[0]!.guestMarked).toBe(false);
    });

    it('marks a cell for the guest player', () => {
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex: 3, player: 'guest' });
      expect(result.marks[3]!.guestMarked).toBe(true);
      expect(result.marks[3]!.hostMarked).toBe(false);
    });

    it('does not affect the other player mark when marking', () => {
      const marks = initialGameState.marks.map((m, i) =>
        i === 5 ? { hostMarked: true, guestMarked: false } : { ...m }
      );
      const state: GameState = { ...initialGameState, marks };
      const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex: 5, player: 'guest' });
      expect(result.marks[5]!.hostMarked).toBe(true);
      expect(result.marks[5]!.guestMarked).toBe(true);
    });

    it('is idempotent - marking an already marked cell returns same state', () => {
      const marks = initialGameState.marks.map((m, i) =>
        i === 2 ? { hostMarked: true, guestMarked: false } : { ...m }
      );
      const state: GameState = { ...initialGameState, marks };
      const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex: 2, player: 'host' });
      expect(result).toBe(state); // Same reference - no change
    });

    it('ignores out-of-bounds cell index (negative)', () => {
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex: -1, player: 'host' });
      expect(result).toBe(state);
    });

    it('ignores out-of-bounds cell index (>= 25)', () => {
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'MARK_CELL', cellIndex: 25, player: 'host' });
      expect(result).toBe(state);
    });
  });

  describe('UNMARK_CELL', () => {
    it('unmarks a cell for the host player', () => {
      const marks = initialGameState.marks.map((m, i) =>
        i === 4 ? { hostMarked: true, guestMarked: true } : { ...m }
      );
      const state: GameState = { ...initialGameState, marks };
      const result = gameStateReducer(state, { type: 'UNMARK_CELL', cellIndex: 4, player: 'host' });
      expect(result.marks[4]!.hostMarked).toBe(false);
      expect(result.marks[4]!.guestMarked).toBe(true);
    });

    it('unmarks a cell for the guest player without affecting host', () => {
      const marks = initialGameState.marks.map((m, i) =>
        i === 10 ? { hostMarked: true, guestMarked: true } : { ...m }
      );
      const state: GameState = { ...initialGameState, marks };
      const result = gameStateReducer(state, { type: 'UNMARK_CELL', cellIndex: 10, player: 'guest' });
      expect(result.marks[10]!.hostMarked).toBe(true);
      expect(result.marks[10]!.guestMarked).toBe(false);
    });

    it('is idempotent - unmarking an already unmarked cell returns same state', () => {
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'UNMARK_CELL', cellIndex: 7, player: 'host' });
      expect(result).toBe(state); // Same reference - no change
    });

    it('ignores out-of-bounds cell index', () => {
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'UNMARK_CELL', cellIndex: 30, player: 'guest' });
      expect(result).toBe(state);
    });
  });

  describe('SET_BOARD', () => {
    it('sets the board and updates seed and categoryIds', () => {
      const board: Board = {
        cells: Array.from({ length: 25 }, (_, i) => ({
          index: i,
          text: `Cell ${i}`,
          categoryId: 'cat-1',
        })),
        seed: 'test-seed-123',
        categoryIds: ['cat-1', 'cat-2'],
      };
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'SET_BOARD', board });
      expect(result.board).toBe(board);
      expect(result.seed).toBe('test-seed-123');
      expect(result.categoryIds).toEqual(['cat-1', 'cat-2']);
    });
  });

  describe('SYNC_STATE', () => {
    it('replaces the entire state with the synced state', () => {
      const syncedState: GameState = {
        board: null,
        marks: Array.from({ length: 25 }, () => ({ hostMarked: true, guestMarked: false })),
        myRole: 'guest',
        connected: true,
        bingoLines: [{ type: 'row', index: 0 }],
        seed: 'synced-seed',
        categoryIds: ['cat-a'],
      };
      const state = { ...initialGameState };
      const result = gameStateReducer(state, { type: 'SYNC_STATE', state: syncedState });
      expect(result).toEqual(syncedState);
    });
  });

  describe('RESET', () => {
    it('resets state to initial values', () => {
      const modifiedState: GameState = {
        board: null,
        marks: Array.from({ length: 25 }, () => ({ hostMarked: true, guestMarked: true })),
        myRole: 'guest',
        connected: true,
        bingoLines: [{ type: 'diagonal', index: 0 }],
        seed: 'some-seed',
        categoryIds: ['cat-1'],
      };
      const result = gameStateReducer(modifiedState, { type: 'RESET' });
      expect(result).toEqual(initialGameState);
    });
  });
});
