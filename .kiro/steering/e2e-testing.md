---
inclusion: manual
---

# Running E2E Tests

## Command

To run E2E tests from Kiro:

```bash
npx playwright test --reporter=list
```

Or to run a specific test file:

```bash
npx playwright test e2e/game-flow.spec.ts --reporter=list
```

The `SUPABASE_SERVICE_ROLE_KEY` is loaded from `.env.local` by the Playwright config — no need to pass it inline.

## Rules for Kiro Agent

- **NEVER** use `--reporter=html` — it starts a web server and blocks indefinitely waiting for Ctrl+C
- **ALWAYS** use `--reporter=list` for clean terminal output
- Suppress the Supabase CLI warnings with `2>/dev/null` on the status command
- The dev server is auto-started by Playwright (configured in `playwright.config.ts` via `webServer`)
- If the dev server is already running on port 5174, Playwright will reuse it (`reuseExistingServer: true`)
- Set a timeout on the `execute_bash` call (90 seconds is usually enough for the full suite)

## Prerequisites

Before running E2E tests, ensure:
1. Docker is running (required by local Supabase)
2. `supabase start` has been run (local Supabase stack is up)
3. Database migrations have been applied (`supabase db reset` or migrations applied)
4. Playwright browsers are installed (`npx playwright install chromium`)

## Filtering Tests

```bash
# Run only game flow tests
npx playwright test e2e/game-flow.spec.ts --reporter=list

# Run only RLS policy tests
npx playwright test e2e/rls-policies.spec.ts --reporter=list

# Run a specific test by title
npx playwright test --grep "Host creates room" --reporter=list
```

## Troubleshooting

- **"Anonymous sign-ins are disabled"**: Run `supabase stop && supabase start` to reload config.toml
- **"permission denied for table rooms"**: Ensure the `grant_table_access` migration has been applied
- **"supabaseKey is required"**: The `.env.local` file must have `VITE_SUPABASE_ANON_KEY` set
- **Checkbox click fails**: E2E tests click category text labels, not checkboxes (they have `pointer-events-none`)
