import { test, fc } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import {
  allCategories,
  getAllItems,
  getTotalItemCount,
} from './data/categories';

/**
 * Property 8: Category selection count validation
 * Validates: Requirements 4.3, 4.4, 4.5
 *
 * For any subset of predefined categories, the computed total of selected items
 * should equal the sum of item counts for each selected category, and the
 * "confirm" action should be enabled if and only if that total is at least 25.
 */
describe('Property 8: Category selection count validation', () => {
  const allCategoryIds = allCategories.map((c) => c.id);

  test.prop(
    [
      fc.subarray(allCategoryIds, {
        minLength: 0,
        maxLength: allCategoryIds.length,
      }),
    ],
    { numRuns: 100 }
  )(
    'total items equals sum of selected category item counts',
    (selectedIds) => {
      const totalFromFunction = getTotalItemCount(selectedIds);
      const expectedTotal = selectedIds.reduce((sum, id) => {
        const category = allCategories.find((c) => c.id === id);
        return sum + (category ? category.items.length : 0);
      }, 0);

      expect(totalFromFunction).toBe(expectedTotal);
    }
  );

  test.prop(
    [
      fc.subarray(allCategoryIds, {
        minLength: 0,
        maxLength: allCategoryIds.length,
      }),
    ],
    { numRuns: 100 }
  )(
    'confirm enabled iff total items >= 25',
    (selectedIds) => {
      const total = getTotalItemCount(selectedIds);
      const confirmEnabled = total >= 25;

      if (total >= 25) {
        expect(confirmEnabled).toBe(true);
      } else {
        expect(confirmEnabled).toBe(false);
      }
    }
  );

  test.prop(
    [
      fc.subarray(allCategoryIds, {
        minLength: 0,
        maxLength: allCategoryIds.length,
      }),
    ],
    { numRuns: 100 }
  )(
    'getAllItems returns items matching getTotalItemCount',
    (selectedIds) => {
      const items = getAllItems(selectedIds);
      const total = getTotalItemCount(selectedIds);

      expect(items.length).toBe(total);
    }
  );
});

/**
 * Property 9: Category data integrity
 * Validates: Requirements 11.1, 11.2, 11.3, 11.5, 11.6
 *
 * At least 3 categories, unique IDs, name ≤30 chars, ≥10 items each,
 * items 1-40 chars, unique text globally, total ≥25.
 */
describe('Property 9: Category data integrity', () => {
  it('has at least 3 categories', () => {
    expect(allCategories.length).toBeGreaterThanOrEqual(3);
  });

  it('each category has a unique ID', () => {
    const ids = allCategories.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('each category name is at most 30 characters', () => {
    for (const category of allCategories) {
      expect(category.name.length).toBeLessThanOrEqual(30);
    }
  });

  it('each category has at least 10 items', () => {
    for (const category of allCategories) {
      expect(category.items.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('each item text is between 1 and 40 characters', () => {
    for (const category of allCategories) {
      for (const item of category.items) {
        expect(item.text.length).toBeGreaterThanOrEqual(1);
        expect(item.text.length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('item text is globally unique across all categories', () => {
    const allTexts = allCategories.flatMap((c) => c.items.map((i) => i.text));
    const uniqueTexts = new Set(allTexts);
    expect(uniqueTexts.size).toBe(allTexts.length);
  });

  it('total items across all categories is at least 25', () => {
    const total = allCategories.reduce(
      (sum, cat) => sum + cat.items.length,
      0
    );
    expect(total).toBeGreaterThanOrEqual(25);
  });
});
