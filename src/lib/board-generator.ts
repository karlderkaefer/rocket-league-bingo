import seedrandom from 'seedrandom';
import { getCategoriesByIds } from '@/features/categories/data/categories';

/**
 * A single cell on the bingo board.
 */
export interface Cell {
  text: string;
  categoryId: string;
  index: number; // 0-24, position on the board
}

/**
 * The bingo board generated from a seed and category selection.
 */
export interface Board {
  cells: Cell[];
  seed: string;
  categoryIds: string[];
  boardSize: number;
}

/**
 * Input parameters for board generation.
 */
export interface BoardGeneratorInput {
  seed: string;
  categoryIds: readonly string[];
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
/**
 * Extract board size from categoryIds array.
 * Convention: a `_board:N` entry encodes the board size.
 * Returns the size and the filtered category IDs (without the metadata entry).
 */
function parseBoardConfig(categoryIds: readonly string[]): { boardSize: number; realCategoryIds: string[] } {
  let boardSize = 5;
  const realCategoryIds: string[] = [];

  for (const id of categoryIds) {
    if (id.startsWith('_board:')) {
      const parsed = parseInt(id.slice(7), 10);
      if (parsed >= 3 && parsed <= 5) {
        boardSize = parsed;
      }
    } else {
      realCategoryIds.push(id);
    }
  }

  return { boardSize, realCategoryIds };
}

/**
 * Generate a deterministic bingo board from a seed and category selection.
 *
 * Algorithm:
 * 1. Parse board size from categoryIds (default 5×5)
 * 2. Collect all items from selected categories (in category order)
 * 3. Seed Alea PRNG with the provided seed
 * 4. Fisher-Yates shuffle the pool using the seeded PRNG
 * 5. Take the first N×N items
 * 6. Assign to cells array (row-major order)
 *
 * The same seed + same categoryIds will always produce the identical board,
 * regardless of platform or execution environment.
 */
export function generateBoard(input: BoardGeneratorInput): Board {
  const { seed, categoryIds } = input;
  const { boardSize, realCategoryIds } = parseBoardConfig(categoryIds);
  const cellCount = boardSize * boardSize;

  // 1. Collect all items from selected categories into a pool
  const categories = getCategoriesByIds(realCategoryIds);
  const pool: { text: string; categoryId: string }[] = [];
  for (const category of categories) {
    for (const item of category.items) {
      pool.push({ text: item.text, categoryId: category.id });
    }
  }

  // 2. Initialize seeded PRNG with Alea algorithm (faster, deterministic)
  const rng = seedrandom.alea(seed);

  // 3. Fisher-Yates shuffle the pool using the seeded PRNG
  shuffle(pool, rng);

  // 4. Take the first N×N items from the shuffled pool
  const selected = pool.slice(0, cellCount);

  // 5. Assign to cells array (row-major order)
  const cells: Cell[] = selected.map((item, index) => ({
    text: item.text,
    categoryId: item.categoryId,
    index,
  }));

  return { cells, seed, categoryIds: realCategoryIds, boardSize };
}
