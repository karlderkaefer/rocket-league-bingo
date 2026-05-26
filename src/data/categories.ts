import type { Category } from '../types';

/**
 * Predefined Rocket League bingo categories.
 * Each category has a unique id, name, and at least 10 items.
 * Each item is ≤40 characters and unique within its category.
 */
export const allCategories: Category[] = [
  {
    id: 'shot-speeds',
    name: 'Shot Speeds',
    items: [
      'Shot over 100 km/h',
      'Shot over 120 km/h',
      'Shot over 140 km/h',
      'Shot under 50 km/h',
      'Shot between 60-80 km/h',
      'Shot between 80-100 km/h',
      'Pinch shot over 150 km/h',
      'Ground shot over 90 km/h',
      'Aerial shot over 110 km/h',
      'Slow roller under 30 km/h',
      'Power shot over 130 km/h',
      'Redirect over 100 km/h',
    ],
  },
  {
    id: 'shot-types',
    name: 'Shot Types',
    items: [
      'Aerial Goal',
      'Bicycle Kick Goal',
      'Backboard Goal',
      'Double Touch',
      'Ground Shot Goal',
      'Long Shot Goal',
      'Pool Shot',
      'Redirect Goal',
      'Turtle Goal',
      'Overtime Goal',
      'Swish Goal',
      'Dribble Flick Goal',
    ],
  },
  {
    id: 'game-events',
    name: 'Game Events',
    items: [
      'Epic Save',
      'Hat Trick',
      'Playmaker Assist',
      'MVP Award',
      'First Touch Goal',
      'Demolition',
      'Overtime Win',
      'Zero Second Goal',
      'Own Goal',
      'Shutout Victory',
      'Bumped off the ball',
      'Whiff on open net',
    ],
  },
];

/**
 * Retrieve a category by its unique id.
 * Returns undefined if no category matches the given id.
 */
export function getCategory(id: string): Category | undefined {
  return allCategories.find((category) => category.id === id);
}
