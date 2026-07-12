# Coding Standards

## TypeScript

- Use strict mode (`"strict": true` in tsconfig).
- Prefer `interface` over `type` for object shapes that may be extended.
- Use `type` for unions, intersections, and utility types.
- Never use `any`. Use `unknown` and narrow with type guards.
- Export types from the file where they're defined, co-located with the code that uses them.

## React Conventions

- Use functional components exclusively.
- Use named exports (not default exports) for components and hooks.
- Keep components small and focused — extract logic into custom hooks.
- Use `React.FC` sparingly; prefer explicit props typing.

```typescript
// Preferred
interface BoardGridProps {
  cells: Cell[];
  onCellClick: (index: number) => void;
}

export function BoardGrid({ cells, onCellClick }: BoardGridProps) {
  // ...
}
```

## File Naming

- Components: `PascalCase.tsx` (e.g., `BoardGrid.tsx`, `BingoCell.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useRoom.ts`, `useAuth.ts`)
- Utilities/lib: `kebab-case.ts` (e.g., `board-generator.ts`, `share-code.ts`)
- Types: co-located in `types.ts` within the feature folder
- Tests: `*.test.ts` or `*.test.tsx` next to the file they test
- Property tests: `*.prop.test.ts` next to the module they validate

## Testing

- Pure logic (board generator, bingo detector, share code) gets property-based tests.
- React components get unit tests with React Testing Library.
- Integration flows (room creation, joining, game play) get Playwright E2E tests.
- Test file lives next to the source file it tests.
- Use `describe` blocks to group related tests.
- Prefer testing behavior over implementation details.

## CSS / Styling

- Use Tailwind CSS utility classes as the primary styling approach.
- Use shadcn/ui components for standard UI elements (buttons, inputs, cards, dialogs).
- For component-specific styles that can't be expressed in Tailwind, use CSS Modules (`.module.css`).
- Avoid inline style objects unless truly dynamic.

## Imports

- Group imports in this order (separated by blank lines):
  1. React / external libraries
  2. Internal absolute imports (`@/...`)
  3. Relative imports
- Use the `@/` alias for all non-relative imports.

## Error Handling

- Wrap async operations in try/catch at the call site.
- Show user-facing errors via toast notifications or inline messages.
- Log technical error details to `console.error`.
- Never swallow errors silently.

## Git Conventions

- Commit messages: imperative mood, concise (`Add room creation flow`, `Fix bingo detection edge case`)
- Branch names: `feature/room-creation`, `fix/share-code-decode`
- Keep commits focused — one logical change per commit.

## E2E Testing Requirement

- Every significant new feature MUST include an E2E test in `e2e/`.
- "Significant" means: new user-facing functionality, new pages, new flows, or changes to existing flows that affect user interaction.
- E2E tests use Playwright with `--reporter=list` and run against a local Supabase instance.
- After implementing a feature, run `npx playwright test --reporter=list --workers=1` to verify.
- Small refactors, style-only changes, or internal logic changes (covered by unit/property tests) do not require E2E tests.
