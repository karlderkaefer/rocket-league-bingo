import type { Category, CategoryItem } from '../types';

/**
 * Predefined Rocket League bingo categories.
 * Each category has a unique id, name (≤30 chars), and at least 10 items.
 * Each item has a unique ID and text between 1-40 characters.
 * Item text is globally unique across all categories.
 */
export const allCategories: Category[] = [
  {
    id: 'shot-speeds',
    name: 'Shot Speeds',
    icon: '⚡',
    items: [
      { id: 'ss-1', text: 'Shot over 100 km/h' },
      { id: 'ss-2', text: 'Shot over 120 km/h' },
      { id: 'ss-3', text: 'Shot over 140 km/h' },
      { id: 'ss-4', text: 'Shot under 50 km/h' },
      { id: 'ss-5', text: 'Shot between 60-80 km/h' },
      { id: 'ss-6', text: 'Shot between 80-100 km/h' },
      { id: 'ss-7', text: 'Pinch shot over 150 km/h' },
      { id: 'ss-8', text: 'Ground shot over 90 km/h' },
      { id: 'ss-9', text: 'Aerial shot over 110 km/h' },
      { id: 'ss-10', text: 'Slow roller under 30 km/h' },
      { id: 'ss-11', text: 'Power shot over 130 km/h' },
      { id: 'ss-12', text: 'Redirect over 100 km/h' },
    ],
  },
  {
    id: 'shot-types',
    name: 'Shot Types',
    icon: '🎯',
    items: [
      { id: 'st-1', text: 'Aerial Goal' },
      { id: 'st-2', text: 'Bicycle Kick Goal' },
      { id: 'st-3', text: 'Backboard Goal' },
      { id: 'st-4', text: 'Double Touch' },
      { id: 'st-5', text: 'Ground Shot Goal' },
      { id: 'st-6', text: 'Long Shot Goal' },
      { id: 'st-7', text: 'Pool Shot' },
      { id: 'st-8', text: 'Redirect Goal' },
      { id: 'st-9', text: 'Turtle Goal' },
      { id: 'st-10', text: 'Overtime Goal' },
      { id: 'st-11', text: 'Swish Goal' },
      { id: 'st-12', text: 'Dribble Flick Goal' },
    ],
  },
  {
    id: 'game-events',
    name: 'Game Events',
    icon: '🏆',
    items: [
      { id: 'ge-1', text: 'Epic Save' },
      { id: 'ge-2', text: 'Hat Trick' },
      { id: 'ge-3', text: 'Playmaker Assist' },
      { id: 'ge-4', text: 'MVP Award' },
      { id: 'ge-5', text: 'First Touch Goal' },
      { id: 'ge-6', text: 'Demolition' },
      { id: 'ge-7', text: 'Overtime Win' },
      { id: 'ge-8', text: 'Zero Second Goal' },
      { id: 'ge-9', text: 'Own Goal' },
      { id: 'ge-10', text: 'Shutout Victory' },
      { id: 'ge-11', text: 'Bumped off the ball' },
      { id: 'ge-12', text: 'Whiff on open net' },
    ],
  },
];

/**
 * Retrieve a category by its unique id.
 * Returns undefined if no category matches the given id.
 */
export function getCategoryById(id: string): Category | undefined {
  return allCategories.find((category) => category.id === id);
}

/**
 * Get categories by an array of IDs, preserving order.
 */
export function getCategoriesByIds(ids: readonly string[]): Category[] {
  return ids
    .map((id) => getCategoryById(id))
    .filter((cat): cat is Category => cat !== undefined);
}

/**
 * Get all category IDs.
 */
export function getAllCategoryIds(): string[] {
  return allCategories.map((cat) => cat.id);
}

/**
 * Get all items from the given category IDs, preserving category order.
 * Returns a flat array of CategoryItems from all matching categories.
 */
export function getAllItems(categoryIds: string[]): CategoryItem[] {
  const categories = getCategoriesByIds(categoryIds);
  return categories.flatMap((cat) => cat.items);
}

/**
 * Calculate the total number of items across the given category IDs.
 */
export function getTotalItemCount(categoryIds: string[]): number {
  const categories = getCategoriesByIds(categoryIds);
  return categories.reduce((sum, cat) => sum + cat.items.length, 0);
}

/**
 * Get the icon emoji for a category by its ID.
 */
export function getCategoryIcon(categoryId: string): string {
  return getCategoryById(categoryId)?.icon ?? '';
}
