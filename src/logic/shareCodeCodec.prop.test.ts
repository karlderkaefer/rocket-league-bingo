import { test, fc } from '@fast-check/vitest';
import { expect } from 'vitest';
import { encodeShareCode, decodeShareCode } from './shareCodeCodec';
import { allCategories } from '../data/categories';
import type { ShareCodeData } from './shareCodeCodec';

/**
 * Property 1: Share code round-trip
 *
 * For any valid seed (22-char base62 string) and any valid category selection
 * (non-empty subset of allCategories), encoding into a share code and then
 * decoding should produce the original seed and category selection, and the
 * share code should be no longer than 32 characters.
 *
 * **Validates: Requirements 1.2, 2.1**
 */

const base62Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const seedArb = fc.string({ minLength: 22, maxLength: 22, unit: fc.constantFrom(...base62Chars.split('')) });

const allCategoryIds = allCategories.map(c => c.id);
const categoryIdsArb = fc.subarray(allCategoryIds, { minLength: 1 });

test.prop([seedArb, categoryIdsArb], { numRuns: 100 })(
  'share code round-trip preserves seed and categories, code ≤32 chars',
  (seed, categoryIds) => {
    const data: ShareCodeData = {
      peerId: `rlb-${seed}`,
      seed,
      categoryIds,
    };

    // Encode the share code
    const code = encodeShareCode(data);

    // Share code must be ≤32 characters
    expect(code.length).toBeLessThanOrEqual(32);

    // Decode the share code
    const decoded = decodeShareCode(code);

    // Decoding must succeed
    expect(decoded).not.toBeNull();

    // Seed must round-trip exactly
    expect(decoded!.seed).toBe(seed);

    // Category IDs must round-trip (order may differ due to bitmask encoding)
    expect(decoded!.categoryIds.sort()).toEqual([...categoryIds].sort());

    // Derived peerId must match `rlb-${seed}`
    expect(decoded!.peerId).toBe(`rlb-${seed}`);
  }
);
