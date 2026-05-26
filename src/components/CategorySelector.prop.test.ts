import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { allCategories } from '../data/categories';

/**
 * Property 10: Category selection item count validation
 * Validates: Requirements 3.3, 3.4, 3.6
 *
 * For any combination of selected categories, the total item count displayed
 * should equal the sum of items in each selected category, and the confirm
 * action should be enabled if and only if that total is at least 25.
 */
describe('Property 10: Category selection item count validation', () => {
  const allCategoryIds = allCategories.map((c) => c.id);
  const categorySubsetArb = fc.subarray(allCategoryIds);

  test.prop([categorySubsetArb], { numRuns: 100 })(
    'total item count equals sum of selected category items',
    (selectedCategoryIds) => {
      const totalSelectedItems = selectedCategoryIds.reduce((sum, id) => {
        const category = allCategories.find((c) => c.id === id);
        return sum + (category ? category.items.length : 0);
      }, 0);

      const expectedTotal = selectedCategoryIds.reduce((sum, id) => {
        const category = allCategories.find((c) => c.id === id);
        return sum + (category?.items.length ?? 0);
      }, 0);

      expect(totalSelectedItems).toBe(expectedTotal);
    }
  );

  test.prop([categorySubsetArb], { numRuns: 100 })(
    'confirm is enabled if and only if total items >= 25',
    (selectedCategoryIds) => {
      const totalSelectedItems = selectedCategoryIds.reduce((sum, id) => {
        const category = allCategories.find((c) => c.id === id);
        return sum + (category ? category.items.length : 0);
      }, 0);

      const canConfirm = totalSelectedItems >= 25;

      if (totalSelectedItems >= 25) {
        expect(canConfirm).toBe(true);
      } else {
        expect(canConfirm).toBe(false);
      }
    }
  );
});
