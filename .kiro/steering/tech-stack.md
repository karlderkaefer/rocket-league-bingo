# Technology Stack

This project uses the **cheap static SPA** approach with Supabase — NOT Next.js.

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Vite + React 19 | Static SPA, no server needed, cheaper to host |
| Language | TypeScript with strict mode | Type safety across frontend and database types |
| UI | Tailwind CSS + shadcn/ui | Scoped utility styles, components live in source code |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) | Managed backend, no custom server |
| Supabase client | `@supabase/supabase-js` | Browser-only client, no SSR package needed |
| Validation | Zod | Schema validation for forms and data |
| Forms | React Hook Form + Zod resolvers | Performant forms with schema validation |
| Routing | React Router v7 (hash-based or browser) | SPA routing, no server rewrites needed |
| State | React Context + useReducer | Simple enough for this app's scope |
| Seeded PRNG | `seedrandom` (Alea algorithm) | Deterministic board generation |
| Testing | Vitest + @fast-check/vitest + Playwright | Unit, property-based, and E2E |
| Package manager | pnpm or npm | Whatever is already configured |
| Database types | Generated from Supabase CLI | `supabase gen types typescript` |
| Database changes | Supabase CLI + SQL migrations | Version-controlled schema changes |

## What We Do NOT Use

- **Next.js** — We don't need SSR, SEO, or server components. This is a fully authenticated app.
- **@supabase/ssr** — No server-side rendering, no cookie-based sessions needed.
- **TanStack Query** — Avoid unless a specific screen genuinely needs client caching/pagination. Don't wrap every Supabase query in it.
- **ORM (Drizzle, Prisma)** — Use `supabase-js` + generated types + SQL migrations directly.
- **Vercel** — Static hosting (GitHub Pages, Netlify, or similar) is sufficient.

## Architecture Principle: RLS-First, Server-When-Needed

```
Static frontend (Vite build → HTML/JS/CSS)
    │
    ├── Supabase Auth (anonymous + OAuth)
    ├── Supabase Database with RLS (direct browser access)
    ├── Supabase Realtime (WebSocket subscriptions)
    └── Supabase Storage (if needed)
```

- The browser talks directly to Supabase using the **publishable key** (anon key).
- This is safe because **Row Level Security** protects all tables.
- No backend-for-frontend, no API routes, no Node.js server in production.
- Add Supabase Edge Functions ONLY for privileged operations (webhooks, admin actions, third-party integrations).

## Environment Variables

Use `VITE_` prefix for client-accessible env vars:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**NEVER** expose the `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Supabase Client Setup

```typescript
// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/database.types';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

## Deployment

The app builds to static files via `vite build` and can be deployed to any static hosting:
- GitHub Pages
- Netlify
- Cloudflare Pages
- Any CDN or file server

No Node.js runtime needed in production.
