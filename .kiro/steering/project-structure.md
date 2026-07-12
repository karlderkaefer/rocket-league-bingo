# Project Structure

Organize code by feature, not by type. Avoid giant global folders like `hooks/`, `services/`, `utils/`.

## Directory Layout

```
src/
  app/                        # App entry, router, providers
    App.tsx
    router.tsx
    providers.tsx
  components/
    ui/                       # shadcn/ui components (auto-generated)
    forms/                    # Reusable form components
  features/
    auth/                     # Authentication feature
      components/
      hooks/
      auth.ts
    rooms/                    # Room creation and joining
      components/
      hooks/
      queries.ts
      actions.ts
      schemas.ts
      types.ts
    game/                     # Active game board, marking, bingo
      components/
      hooks/
      queries.ts
      actions.ts
      types.ts
    categories/               # Category data and selection
      components/
      data/
      types.ts
  lib/
    supabase/
      client.ts              # Supabase browser client singleton
      types.ts               # Re-exports from generated types
    board-generator.ts       # Pure deterministic board generation
    bingo-detector.ts        # Pure bingo detection logic
    share-code.ts            # Share code encode/decode
  database.types.ts          # Generated: supabase gen types typescript
  main.tsx
  index.css

supabase/
  migrations/                # SQL migration files (version controlled)
  seed.sql                   # Development seed data
  config.toml                # Supabase local config

public/
  favicon.svg
```

## Key Principles

1. **Feature folders** contain everything related to that feature: components, hooks, queries, types.
2. **Pure logic** lives in `src/lib/` — no React dependencies, easily testable.
3. **Database types** are generated, never hand-written. Run `supabase gen types typescript --local > src/database.types.ts`.
4. **Components** that are reused across features go in `src/components/`.
5. **Each feature** should be independently understandable by reading its folder.

## Import Aliases

Configure a `@/` path alias in `vite.config.ts` and `tsconfig.json`:

```typescript
// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

Use `@/features/rooms/queries` instead of `../../../features/rooms/queries`.
