import { useState } from 'react';

import { allCategories } from '@/features/categories/data/categories';

/**
 * Collapsible category legend showing which icon/emoji belongs to which category.
 * Collapsed by default — user clicks to expand.
 */
export function CategoryLegend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={isOpen}
        aria-label="Toggle category legend"
      >
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>Categories</span>
      </button>

      {isOpen && (
        <div className="mt-1.5 flex flex-wrap gap-3 pl-4">
          {allCategories.map((category) => (
            <div key={category.id} className="flex items-center gap-1">
              <span aria-hidden="true">{category.icon}</span>
              <span className="text-muted-foreground">{category.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
