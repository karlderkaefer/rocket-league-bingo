import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { generateBoard } from './board-generator';
import { getAllItems } from '@/features/categories/data/categories';

/**
 * Property 2: Board determinism and size
 *
 * For any valid seed and category selection (with ≥25 total items),
 * calling generateBoard twice with the same inputs produces an identical
 * 5×5 board of exactly 25 cells.
 *
 * **Validates: Requirements 5.1, 5.2, 5.4, 5.5**
 */

// Generator for valid seed strings (1-22 char alphanumeric)
const seedArb = fc.string({ minLength: 1, maxLength: 22 });

// All 3 categories (36 items ≥ 25)
const allCategoryIds = ['shot-speeds', 'shot-types', 'game-events'] as const;
const categoryIdsArb = fc.constant<string[]>([...allCategoryIds]);

describe('Property 2: Board determinism and size', () => {
  test.prop([seedArb, categoryIdsArb], { numRuns: 100 })(
    'same seed + categories always produces identical 25-cell board',
    (seed: string, categoryIds: string[]) => {
      const board1 = generateBoard({ seed, categoryIds });
      const board2 = generateBoard({ seed, categoryIds });

      // Board must have exactly 25 cells
      expect(board1.cells).toHaveLength(25);
      expect(board2.cells).toHaveLength(25);

      // Both boards must be identical
      expect(board1.cells).toEqual(board2.cells);

      // Board metadata preserved
      expect(board1.seed).toBe(seed);
      expect(board1.categoryIds).toEqual(categoryIds);
    },
  );

  test.prop([seedArb, categoryIdsArb], { numRuns: 100 })(
    'each cell has a valid index from 0 to 24',
    (seed: string, categoryIds: string[]) => {
      const board = generateBoard({ seed, categoryIds });

      for (let i = 0; i < 25; i++) {
        expect(board.cells[i]!.index).toBe(i);
      }
    },
  );
});

/**
 * Property 3: Board items from selected categories
 *
 * For any valid seed and category selection (with ≥25 total items),
 * every cell text belongs to one of the selected categories and no
 * two cells share the same text value.
 *
 * **Validates: Requirements 5.1, 5.4**
 */
describe('Property 3: Board items from selected categories', () => {
  test.prop([seedArb, categoryIdsArb], { numRuns: 100 })(
    'every cell text belongs to a selected category',
    (seed: string, categoryIds: string[]) => {
      const board = generateBoard({ seed, categoryIds });
      const validItems = getAllItems(categoryIds);
      const validTexts = new Set(validItems.map((item) => item.text));

      for (const cell of board.cells) {
        expect(validTexts.has(cell.text)).toBe(true);
      }
    },
  );

  test.prop([seedArb, categoryIdsArb], { numRuns: 100 })(
    'no duplicate cell texts on the board',
    (seed: string, categoryIds: string[]) => {
      const board = generateBoard({ seed, categoryIds });
      const texts = board.cells.map((cell) => cell.text);
      const uniqueTexts = new Set(texts);

      expect(uniqueTexts.size).toBe(25);
    },
  );

  test.prop([seedArb, categoryIdsArb], { numRuns: 100 })(
    'each cell categoryId is one of the selected categories',
    (seed: string, categoryIds: string[]) => {
      const board = generateBoard({ seed, categoryIds });
      const validCategoryIds = new Set(categoryIds);

      for (const cell of board.cells) {
        expect(validCategoryIds.has(cell.categoryId)).toBe(true);
      }
    },
  );
});
