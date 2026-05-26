import { allCategories } from '../data/categories';
import styles from './CategorySelector.module.css';

interface CategorySelectorProps {
  selectedCategoryIds: string[];
  onToggleCategory: (categoryId: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export default function CategorySelector({
  selectedCategoryIds,
  onToggleCategory,
  onConfirm,
  disabled = false,
}: CategorySelectorProps) {
  // Calculate total selected items from selected categories
  const totalSelectedItems = selectedCategoryIds.reduce((sum, id) => {
    const category = allCategories.find((c) => c.id === id);
    return sum + (category ? category.items.length : 0);
  }, 0);

  const canConfirm = totalSelectedItems >= 25;
  const itemsNeeded = Math.max(0, 25 - totalSelectedItems);

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Select Categories</h2>
      <p className={styles.helpText}>
        Select categories for the bingo board. You need at least 25 items total.
      </p>

      <ul className={styles.categoryList} role="list" aria-label="Available categories">
        {allCategories.map((category) => {
          const isSelected = selectedCategoryIds.includes(category.id);
          return (
            <li key={category.id} className={styles.categoryItem}>
              <label className={styles.categoryLabel}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleCategory(category.id)}
                  disabled={disabled}
                  aria-label={`${category.name} (${category.items.length} items)`}
                />
                <span className={styles.categoryName}>{category.name}</span>
                <span className={styles.categoryCount}>
                  {category.items.length} items
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className={styles.summary} aria-live="polite" aria-atomic="true">
        <p className={styles.totalCount}>
          {totalSelectedItems} item{totalSelectedItems !== 1 ? 's' : ''} selected
        </p>
        {!canConfirm && (
          <p className={styles.itemsNeeded} role="status">
            {itemsNeeded} more item{itemsNeeded !== 1 ? 's' : ''} needed
          </p>
        )}
      </div>

      <button
        onClick={onConfirm}
        disabled={!canConfirm || disabled}
        className={styles.confirmButton}
        aria-disabled={!canConfirm || disabled}
      >
        Confirm Selection
      </button>
    </div>
  );
}
