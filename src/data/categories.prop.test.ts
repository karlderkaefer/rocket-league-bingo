import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import { allCategories } from './categories';

/**
 * Property 9: Category data integrity
 * Validates: Requirements 9.2, 9.3
 *
 * For any category in the predefined data, the category should have a unique name,
 * contain at least 10 items, each item should be no longer than 40 characters,
 * and no item should be duplicated within the same category.
 */
describe('Property 9: Category data integrity', () => {
  test.prop([fc.constantFrom(...allCategories)], { numRuns: 100 })(
    'each category has a unique name across all categories',
    (category) => {
      const matchingNames = allCategories.filter(
        (c) => c.name === category.name
      );
      expect(matchingNames).toHaveLength(1);
    }
  );

  test.prop([fc.constantFrom(...allCategories)], { numRuns: 100 })(
    'each category has at least 10 items',
    (category) => {
      expect(category.items.length).toBeGreaterThanOrEqual(10);
    }
  );

  test.prop([fc.constantFrom(...allCategories)], { numRuns: 100 })(
    'each item is no longer than 40 characters',
    (category) => {
      for (const item of category.items) {
        expect(item.length).toBeLessThanOrEqual(40);
      }
    }
  );

  test.prop([fc.constantFrom(...allCategories)], { numRuns: 100 })(
    'no duplicate items within the same category',
    (category) => {
      const uniqueItems = new Set(category.items);
      expect(uniqueItems.size).toBe(category.items.length);
    }
  );
});
