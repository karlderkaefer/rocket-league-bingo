import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { generateBoard } from './boardGenerator';
import { allCategories } from '../data/categories';

/**
 * Property-based tests for board generation.
 * Validates: Requirements 4.1, 4.2, 4.4, 4.5
 */

const allCategoryIds = allCategories.map((c) => c.id);

// Custom generator: subset of category IDs where total items >= 25
const categorySelectionArb = fc
  .subarray(allCategoryIds, { minLength: 1 })
  .filter((ids) => {
    const total = ids.reduce((sum, id) => {
      const cat = allCategories.find((c) => c.id === id);
      return sum + (cat ? cat.items.length : 0);
    }, 0);
    return total >= 25;
  });

// Custom generator: non-empty seed string
const seedArb = fc.string({ minLength: 1, maxLength: 50 });

describe('boardGenerator property tests', () => {
  /**
   * Property 2: Board generation determinism and size
   *
   * For any valid seed and category selection (with ≥25 total items),
   * calling generateBoard multiple times with the same inputs should always
   * produce an identical 5×5 board of exactly 25 cells.
   *
   * **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
   */
  test.prop([seedArb, categorySelectionArb], { numRuns: 100 })(
    'same seed + categories always produces identical 25-cell board',
    (seed, categoryIds) => {
      const board1 = generateBoard({ seed, categoryIds });
      const board2 = generateBoard({ seed, categoryIds });

      // Board must have exactly 25 cells
      expect(board1.cells).toHaveLength(25);
      expect(board2.cells).toHaveLength(25);

      // Both boards must be identical
      expect(board1).toEqual(board2);
    },
  );

  /**
   * Property 3: Board items are drawn from selected categories only
   *
   * For any valid seed and category selection, every cell on the generated
   * board should contain an item that belongs to one of the selected categories,
   * and no item should appear more than once on the board.
   *
   * **Validates: Requirements 4.1, 4.4**
   */
  test.prop([seedArb, categorySelectionArb], { numRuns: 100 })(
    'all cells belong to selected categories and no duplicates',
    (seed, categoryIds) => {
      const board = generateBoard({ seed, categoryIds });

      // Collect all valid items from selected categories
      const validItems = new Set<string>();
      for (const id of categoryIds) {
        const cat = allCategories.find((c) => c.id === id);
        if (cat) {
          for (const item of cat.items) {
            validItems.add(item);
          }
        }
      }

      // Every cell must belong to a selected category
      for (const cell of board.cells) {
        expect(categoryIds).toContain(cell.categoryId);
        expect(validItems.has(cell.text)).toBe(true);
      }

      // No duplicate items on the board
      const texts = board.cells.map((c) => c.text);
      expect(new Set(texts).size).toBe(texts.length);
    },
  );
});
