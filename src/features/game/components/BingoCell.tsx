import type { Cell } from '@/lib/board-generator';
import type { CellMarks } from '@/lib/bingo-detector';
import { cn } from '@/lib/utils';
import { getCategoryIcon } from '@/features/categories/data/categories';

export interface BingoCellProps {
  cell: Cell;
  marks: CellMarks;
  onClick?: () => void;
  myRole: 'host' | 'guest';
  disabled?: boolean;
  hasError?: boolean;
}

/**
 * Returns Tailwind classes for the cell based on its mark state.
 * Uses shadcn/ui theme variables for consistency across the app.
 *
 * Four visual states:
 * - Unmarked: card background with muted border
 * - Host only: primary color tint
 * - Guest only: accent/secondary color tint
 * - Both: success/green tint
 */
function getCellVariantClasses(marks: CellMarks): string {
  const { hostMarked, guestMarked } = marks;

  if (hostMarked && guestMarked) {
    // Diagonal split handled via inline style
    return 'border-sky-400/60 text-foreground ring-1 ring-sky-400/30';
  }
  if (hostMarked) {
    return 'bg-sky-500/15 border-sky-400/60 text-sky-700 dark:text-sky-300 ring-1 ring-sky-400/30';
  }
  if (guestMarked) {
    return 'bg-amber-500/15 border-amber-400/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30';
  }
  return 'bg-card border-border text-card-foreground hover:bg-accent hover:text-accent-foreground';
}

/**
 * Returns an inline style for the "both" state diagonal gradient.
 */
function getBothStyle(marks: CellMarks): React.CSSProperties | undefined {
  if (marks.hostMarked && marks.guestMarked) {
    return {
      background: 'linear-gradient(135deg, rgb(14 165 233 / 0.15) 50%, rgb(245 158 11 / 0.15) 50%)',
    };
  }
  return undefined;
}

/**
 * Returns an accessible label describing the cell's current state.
 */
function getAriaLabel(cell: Cell, marks: CellMarks, myRole: 'host' | 'guest', disabled?: boolean, hasError?: boolean): string {
  const { hostMarked, guestMarked } = marks;

  let stateDescription: string;
  if (hostMarked && guestMarked) {
    stateDescription = 'marked by both players';
  } else if (hostMarked) {
    stateDescription = 'marked by host';
  } else if (guestMarked) {
    stateDescription = 'marked by guest';
  } else {
    stateDescription = 'unmarked';
  }

  const errorSuffix = hasError ? ', save failed' : '';

  if (disabled) {
    return `${cell.text}, ${stateDescription}${errorSuffix}`;
  }

  const isMarkedByMe =
    (myRole === 'host' && hostMarked) || (myRole === 'guest' && guestMarked);
  const action = isMarkedByMe ? 'Click to unmark' : 'Click to mark';

  return `${cell.text}, ${stateDescription}${errorSuffix}. ${action}`;
}

/**
 * Returns a responsive text size class based on text length.
 * Shorter text gets bigger font, longer text shrinks to fit.
 */
function getTextSizeClass(length: number): string {
  if (length <= 10) return 'text-base sm:text-lg';
  if (length <= 16) return 'text-sm sm:text-base';
  if (length <= 22) return 'text-xs sm:text-sm';
  return 'text-[11px] sm:text-xs';
}

/**
 * A single bingo cell on the board.
 *
 * Visually distinguishes 4 states: unmarked, host-only, guest-only, both.
 * Uses shadcn/ui theme variables for consistent styling across the app.
 */
export function BingoCell({ cell, marks, onClick, myRole, disabled, hasError }: BingoCellProps) {
  const variantClasses = getCellVariantClasses(marks);
  const ariaLabel = getAriaLabel(cell, marks, myRole, disabled, hasError);

  const isMarkedByMe =
    (myRole === 'host' && marks.hostMarked) ||
    (myRole === 'guest' && marks.guestMarked);

  const errorIndicator = hasError ? (
    <span
      className="absolute top-0.5 right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground"
      aria-hidden="true"
      title="Failed to save"
    >
      !
    </span>
  ) : null;

  // Dynamic font size based on text length
  const textSizeClass = getTextSizeClass(cell.text.length);

  // Inline style for "both" diagonal split (CSS vars can't go in Tailwind arbitrary values)
  const bothStyle = getBothStyle(marks);

  const baseClasses = cn(
    'relative flex items-center justify-center',
    'border rounded-md',
    'p-2 sm:p-3',
    'font-medium text-center leading-tight',
    'select-none',
    'aspect-square',
    textSizeClass,
    variantClasses,
  );

  if (disabled) {
    return (
      <div
        role="gridcell"
        aria-label={ariaLabel}
        className={cn(baseClasses, 'opacity-60')}
        style={bothStyle}
      >
        {errorIndicator}
        <span className="absolute top-0.5 left-1 text-xs sm:text-sm" aria-hidden="true">
          {getCategoryIcon(cell.categoryId)}
        </span>
        <span className="break-words">{cell.text}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isMarkedByMe}
      style={bothStyle}
      className={cn(
        baseClasses,
        'transition-all duration-150',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'cursor-pointer',
      )}
    >
      {errorIndicator}
      <span className="absolute top-0.5 left-1 text-xs sm:text-sm" aria-hidden="true">
        {getCategoryIcon(cell.categoryId)}
      </span>
      <span className="break-words">{cell.text}</span>
    </button>
  );
}
