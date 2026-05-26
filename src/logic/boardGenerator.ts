import seedrandom from 'seedrandom';
import { getCategory } from '../data/categories';
import type { Board } from '../types';

export interface BoardGeneratorInput {
  seed: string;
  categoryIds: string[];
}

/**
 * Fisher-Yates shuffle using a seeded PRNG.
 * Mutates the array in place and returns it.
 */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i]!, arr[j]!] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Generate a deterministic 5×5 bingo board from a seed and category selection.
 *
 * The same seed + same categoryIds will always produce the identical board,
 * regardless of platform or execution environment.
 */
export function generateBoard(input: BoardGeneratorInput): Board {
  const { seed, categoryIds } = input;

  // 1. Collect all items from selected categories into a pool
  const pool: { text: string; categoryId: string }[] = [];
  for (const id of categoryIds) {
    const category = getCategory(id);
    if (category) {
      for (const text of category.items) {
        pool.push({ text, categoryId: id });
      }
    }
  }

  // 2. Initialize seeded PRNG with Alea algorithm (faster, deterministic)
  const rng = seedrandom.alea(seed);

  // 3. Fisher-Yates shuffle the pool using the seeded PRNG
  shuffle(pool, rng);

  // 4. Take the first 25 items from the shuffled pool
  const cells = pool.slice(0, 25).map((item, index) => ({
    index,
    text: item.text,
    categoryId: item.categoryId,
  }));

  // 5. Return as a 5×5 board (row-major order)
  return { cells, seed, categoryIds };
}
