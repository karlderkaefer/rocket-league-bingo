import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategorySelector } from './CategorySelector';
import { allCategories } from '@/features/categories/data/categories';

/**
 * Helper to toggle a category by clicking its name text (which is inside the Card).
 * The Card's onClick triggers handleToggle. We avoid clicking the checkbox directly
 * because it would double-fire (Card onClick + checkbox onChange both call handleToggle).
 */
function toggleCategory(categoryName: string) {
  fireEvent.click(screen.getByText(categoryName));
}

describe('CategorySelector', () => {
  it('renders all categories with names and item counts', () => {
    render(<CategorySelector onConfirm={vi.fn()} />);

    for (const category of allCategories) {
      expect(screen.getByLabelText(`Select ${category.name}`)).toBeInTheDocument();
      expect(screen.getByText(category.name)).toBeInTheDocument();
    }

    // Each category shows its item count (e.g., "12 items")
    const itemCountElements = screen.getAllByText(/^\d+ items$/);
    expect(itemCountElements.length).toBe(allCategories.length);
  });

  it('starts with no categories selected and confirm disabled', () => {
    render(<CategorySelector onConfirm={vi.fn()} />);

    const checkboxes = screen.getAllByRole('checkbox');
    for (const checkbox of checkboxes) {
      expect(checkbox).not.toBeChecked();
    }

    expect(screen.getByRole('button', { name: /confirm selection/i })).toBeDisabled();
  });

  it('toggles a category on click and updates the item count', () => {
    render(<CategorySelector onConfirm={vi.fn()} />);

    const firstCategory = allCategories[0]!;
    toggleCategory(firstCategory.name);

    const checkbox = screen.getByLabelText(`Select ${firstCategory.name}`);
    expect(checkbox).toBeChecked();
    expect(screen.getByText(`${firstCategory.items.length} items selected`)).toBeInTheDocument();

    // Toggle off
    toggleCategory(firstCategory.name);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('0 items selected')).toBeInTheDocument();
  });

  it('disables confirm button when total items below 25 and shows items needed', () => {
    render(<CategorySelector onConfirm={vi.fn()} />);

    const firstCategory = allCategories[0]!;
    toggleCategory(firstCategory.name);

    const itemsNeeded = 25 - firstCategory.items.length;
    expect(screen.getByText(new RegExp(`Need ${itemsNeeded} more`))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm selection/i })).toBeDisabled();
  });

  it('enables confirm button when total items reach 25 or more', () => {
    render(<CategorySelector onConfirm={vi.fn()} />);

    // Select enough categories to reach ≥25 items
    let total = 0;
    for (const category of allCategories) {
      toggleCategory(category.name);
      total += category.items.length;
      if (total >= 25) break;
    }

    expect(screen.getByRole('button', { name: /confirm selection/i })).toBeEnabled();
  });

  it('calls onConfirm with selected category IDs when confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<CategorySelector onConfirm={onConfirm} />);

    // Select all categories to meet threshold
    for (const category of allCategories) {
      toggleCategory(category.name);
    }

    fireEvent.click(screen.getByRole('button', { name: /confirm selection/i }));

    expect(onConfirm).toHaveBeenCalledOnce();
    const calledWith = onConfirm.mock.calls[0]![0] as string[];
    // Should contain all category IDs (order may vary since Set is used)
    expect(calledWith).toHaveLength(allCategories.length);
    for (const category of allCategories) {
      expect(calledWith).toContain(category.id);
    }
  });

  it('disables confirm button when isLoading is true', () => {
    render(<CategorySelector onConfirm={vi.fn()} isLoading />);

    // Select all to meet threshold
    for (const category of allCategories) {
      toggleCategory(category.name);
    }

    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });
});
