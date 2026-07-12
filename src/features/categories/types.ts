/**
 * A single item within a bingo category.
 * Each item has a unique ID and text between 1 and 40 characters.
 */
export interface CategoryItem {
  id: string;
  text: string;
}

/**
 * A predefined category of bingo items.
 * Each category has a unique ID, a name (≤30 chars), an emoji icon, and at least 10 items.
 */
export interface Category {
  id: string;
  name: string;
  icon: string;
  items: CategoryItem[];
}
