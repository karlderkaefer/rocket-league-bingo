# Rocket League Bingo

A two-player web app where players compete using a shared 5×5 bingo board populated with Rocket League game events. Mark cells as events happen in-game, and the app detects bingo in real time.

## How It Works

1. **Host** creates a room and selects categories
2. **Guest** joins via a share code or link
3. Both players see an identical board (generated deterministically from a shared seed)
4. Mark cells as Rocket League events occur — marks sync in real time
5. Bingo is detected automatically when a full row, column, or diagonal is completed

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vite + React 19 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| Backend | Supabase (Postgres, Auth, Realtime) |
| Auth | Supabase Anonymous Auth |
| Realtime | Supabase Broadcast channels |
| Validation | Zod |
| Testing | Vitest + @fast-check/vitest + Playwright |
| Routing | React Router v7 (hash-based) |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development)
- Docker (required by Supabase CLI)

### Setup

```bash
# Install dependencies
npm install

# Start local Supabase stack
supabase start

# Apply database migrations
supabase db reset

# Generate TypeScript types from database schema
supabase gen types typescript --local > src/database.types.ts

# Start dev server
npm run dev
```

The app runs at `http://localhost:5174/rocket-league-bingo/`.

### Environment Variables

After `supabase start`, generate your `.env.local`:

```bash
echo "# Supabase (Vite client)" > .env.local
echo "VITE_SUPABASE_URL=$(supabase status -o env 2>/dev/null | grep API_URL | cut -d= -f2 | tr -d '\"')" >> .env.local
echo "VITE_SUPABASE_ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '\"')" >> .env.local
echo "" >> .env.local
echo "# E2E tests (admin access, bypasses RLS)" >> .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o env 2>/dev/null | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '\"')" >> .env.local
```

> **Note:** Local Supabase keys are deterministic — they don't change between restarts. The `.env.local` file is gitignored.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (port 5174) |
| `npm run build` | TypeScript check + Vite production build |
| `npm test` | Run unit + property-based tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build and deploy to GitHub Pages |

## Project Structure

```
src/
  app/                    # App entry, router, providers
  components/ui/          # shadcn/ui components
  features/
    auth/                 # Authentication (anonymous auth)
    rooms/                # Room creation, joining, realtime channel
    game/                 # Game state, board, marking, bingo detection
    categories/           # Category data and selection
  lib/
    supabase/             # Supabase client singleton
    board-generator.ts    # Pure deterministic board generation
    bingo-detector.ts     # Pure bingo detection logic
    share-code.ts         # Share code encode/decode
    retry.ts              # Retry utility with exponential backoff

supabase/
  migrations/             # SQL migration files
  seed.sql                # Development seed data
  config.toml             # Supabase local config

e2e/                      # Playwright E2E tests
```

## Architecture

- **Static SPA** — no server-side rendering, deployed as static files
- **RLS-first** — Row Level Security protects all database tables; the browser talks directly to Supabase using the publishable anon key
- **Optimistic UI** — marks are applied locally before DB confirmation
- **Realtime Broadcast** — mark/unmark actions are broadcast via Supabase channels (not Postgres Changes) for low latency
- **Deterministic boards** — same seed + categories = same board on any device

## Testing

- **Property-based tests** — verify correctness properties (board determinism, bingo detection, mark isolation) across randomized inputs using fast-check
- **Unit tests** — verify specific behavior of components and hooks
- **E2E tests** — verify full game flows with Playwright (requires running Supabase)

### Running unit + property tests

```bash
npm test
```

### Running E2E tests

E2E tests require a running local Supabase instance and Playwright browsers.

```bash
# 1. Install Playwright browsers (first time only)
npx playwright install chromium

# 2. Start Supabase (if not already running)
supabase start

# 3. Run E2E tests
npm run test:e2e
```

The Playwright config automatically loads `.env.local` (for all Supabase keys) and starts the Vite dev server.

> **Note:** Local Supabase keys are deterministic — they don't change between restarts. You can inspect them anytime with `supabase status -o env`.

## Deployment

The app builds to static files and deploys to GitHub Pages:

```bash
npm run deploy
```

No Node.js runtime needed in production.
