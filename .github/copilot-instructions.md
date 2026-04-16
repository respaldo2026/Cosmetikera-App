<!-- Auto-generated guidance for AI coding agents working on this repo -->
# Copilot instructions — academia-crystal

Purpose
- Give concise, actionable context so an AI can make safe, repo-consistent changes.

Quick start / build
- Node engine: >=20 (see `package.json`). Use `npm run dev` to start the dev server.
- Important scripts: `dev` (refine dev), `build` (refine build), `start` (refine start).

Big picture
- This is a Next.js 13 (app directory) + Refine admin app using Ant Design UI.
- Data & auth are handled via Supabase. There is a server/client split for auth:
  - Server-side helpers: `src/utils/supabase/server.ts`, `src/providers/auth-provider/auth-provider.server.ts`.
  - Browser helpers: `src/utils/supabase/client.ts`, `src/providers/auth-provider/auth-provider.client.ts`.
- Routing/resources are configured in `src/app/layout.tsx` via Refine `resources`.

Key integration points & patterns
- Supabase: server client created with `createServerClient(...)` (see `src/utils/supabase/server.ts`).
- Middleware refreshes sessions but is permissive (does not block); see `src/middleware.ts`.
- Auth provider on the server intentionally returns `authenticated: true` in dev (see `auth-provider.server.ts`).
- Client auth uses `createBrowserClient` and Refine `AuthBindings` (see `auth-provider.client.ts`).

Project-specific conventions
- Use the `app/` (Next.js app router). Server components are default; mark client components with `"use client"`.
- Hydration guard pattern: `src/app/layout.tsx` mounts UI only after `useEffect` to avoid hydration errors.
- Providers live under `src/providers/*` (auth, data). Contexts are under `src/contexts/*`.

Security & env
- Several Supabase keys are present in `src/utils/supabase/*` (hard-coded). Do NOT add new secrets to the repo.
- Preferred approach: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in environment or use `src/utils/supabase/constants.ts` carefully.

Editing guidance (practical examples)
- When changing auth flows, update both server and client provider files: 
  - `src/providers/auth-provider/auth-provider.server.ts`
  - `src/providers/auth-provider/auth-provider.client.ts`
- When adjusting cookie/session handling, also inspect `src/middleware.ts` and `src/utils/supabase/server.ts` (they coordinate cookie get/set).
- Example: to create a server Supabase client (used in middleware and server components):
```
import { createServerClient } from '@supabase/ssr'
const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: { get: ... } })
```

Tests & debugging
- There are no explicit test scripts in `package.json`. Use the dev server and browser devtools for runtime debugging.
- For server-side debugging, add logs in `src/middleware.ts` and server provider functions; be careful not to print secrets.

When to ask the maintainers
- If a change requires adding or rotating secrets, or altering middleware auth behavior, ask before pushing.

Files to inspect first (examples)
- `src/app/layout.tsx` — Refine initialization and resources.
- `src/providers/auth-provider/auth-provider.client.ts` — client auth flows.
- `src/providers/auth-provider/auth-provider.server.ts` — server auth shortcuts.
- `src/utils/supabase/server.ts` and `src/utils/supabase/client.ts` — Supabase clients.
- `src/middleware.ts` — session refresh and cookie sync.

If anything here is unclear or you want more detail (e.g., code snippets for common tasks), say which area and I'll expand.
