import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { allCategories, getTotalItemCount } from '@/features/categories/data/categories';

export type BoardSize = 3 | 4 | 5;

interface CategorySelectorProps {
  onConfirm: (categoryIds: string[], boardSize: BoardSize) => void;
  isLoading?: boolean;
}

const BOARD_SIZE_OPTIONS: { value: BoardSize; label: string; cells: number }[] = [
  { value: 3, label: '3×3', cells: 9 },
  { value: 4, label: '4×4', cells: 16 },
  { value: 5, label: '5×5', cells: 25 },
];

export function CategorySelector({ onConfirm, isLoading }: CategorySelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [boardSize, setBoardSize] = useState<BoardSize>(5);

  const requiredCells = boardSize * boardSize;

  const totalItems = useMemo(
    () => getTotalItemCount(Array.from(selectedIds)),
    [selectedIds]
  );

  const itemsNeeded = Math.max(0, requiredCells - totalItems);
  const canConfirm = totalItems >= requiredCells;

  function handleToggle(categoryId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(Array.from(selectedIds), boardSize);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Board size selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Board Size</label>
        <div className="flex gap-2">
          {BOARD_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBoardSize(opt.value)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                boardSize === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-card-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
              <span className="block text-xs opacity-70">{opt.cells} cells</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category cards */}
      <div className="grid gap-3">
        {allCategories.map((category) => {
          const isSelected = selectedIds.has(category.id);
          return (
            <Card
              key={category.id}
              className={`cursor-pointer transition-colors ${
                isSelected
                  ? 'ring-2 ring-primary'
                  : 'hover:ring-1 hover:ring-foreground/20'
              }`}
              size="sm"
              onClick={() => handleToggle(category.id)}
            >
              <CardContent className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="size-4 shrink-0 rounded border-border accent-primary pointer-events-none"
                  aria-label={`Select ${category.name}`}
                />
                <span className="flex-1 font-medium">
                  {category.icon} {category.name}
                </span>
                <span className="text-muted-foreground text-sm">
                  {category.items.length} items
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
        <div>
          <p className="text-sm font-medium">
            {totalItems} items selected
          </p>
          {!canConfirm && (
            <p className="text-xs text-muted-foreground">
              Need {itemsNeeded} more item{itemsNeeded !== 1 ? 's' : ''} for {boardSize}×{boardSize}
            </p>
          )}
        </div>
        <Button
          disabled={!canConfirm || isLoading}
          onClick={handleConfirm}
        >
          {isLoading ? 'Creating...' : 'Confirm Selection'}
        </Button>
      </div>
    </div>
  );
}
