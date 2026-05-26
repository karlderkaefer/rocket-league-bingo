import { describe, it, expect } from 'vitest';
import { generateBoard } from './boardGenerator';

describe('boardGenerator', () => {
  const validInput = {
    seed: 'test-seed-123',
    categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
  };

  it('generates a board with exactly 25 cells', () => {
    const board = generateBoard(validInput);
    expect(board.cells).toHaveLength(25);
  });

  it('produces the same board for the same seed and categories', () => {
    const board1 = generateBoard(validInput);
    const board2 = generateBoard(validInput);
    expect(board1).toEqual(board2);
  });

  it('produces a different board for a different seed', () => {
    const board1 = generateBoard(validInput);
    const board2 = generateBoard({ ...validInput, seed: 'different-seed' });
    // Boards should differ (extremely unlikely to be identical with different seeds)
    expect(board1.cells).not.toEqual(board2.cells);
  });

  it('assigns correct cell indices 0-24', () => {
    const board = generateBoard(validInput);
    for (let i = 0; i < 25; i++) {
      expect(board.cells[i].index).toBe(i);
    }
  });

  it('only includes items from selected categories', () => {
    const board = generateBoard(validInput);
    for (const cell of board.cells) {
      expect(validInput.categoryIds).toContain(cell.categoryId);
    }
  });

  it('does not include duplicate items', () => {
    const board = generateBoard(validInput);
    const texts = board.cells.map((c) => c.text);
    expect(new Set(texts).size).toBe(25);
  });

  it('preserves seed and categoryIds in the returned board', () => {
    const board = generateBoard(validInput);
    expect(board.seed).toBe(validInput.seed);
    expect(board.categoryIds).toEqual(validInput.categoryIds);
  });

  it('works with a subset of categories that have ≥25 items', () => {
    // shot-speeds (12) + shot-types (12) + game-events (12) = 36 items
    const board = generateBoard({
      seed: 'subset-test',
      categoryIds: ['shot-speeds', 'shot-types', 'game-events'],
    });
    expect(board.cells).toHaveLength(25);
  });

  it('handles categories with fewer than 25 total items gracefully', () => {
    // Only shot-speeds has 12 items — board will have fewer than 25 cells
    const board = generateBoard({
      seed: 'small-pool',
      categoryIds: ['shot-speeds'],
    });
    expect(board.cells).toHaveLength(12);
  });

  it('ignores unknown category IDs', () => {
    const board = generateBoard({
      seed: 'unknown-cat',
      categoryIds: ['shot-speeds', 'nonexistent-category'],
    });
    // Should only have items from shot-speeds
    expect(board.cells).toHaveLength(12);
    for (const cell of board.cells) {
      expect(cell.categoryId).toBe('shot-speeds');
    }
  });
});
