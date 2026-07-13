# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Multi-tenant conversational SaaS platform for WhatsApp: a shared core (workspaces, contacts, WhatsApp inbox, AI engine, generic pipeline, calendar, integrations) with independently-activatable vertical modules per workspace — starting with a CRM/sales-support module and an ATS/recruiting module. Stack: Next.js (App Router) + Tailwind CSS, Supabase (auth + backend/database), deployed on Vercel. Integrations: YCloud (WhatsApp BSP), OpenRouter (LLM gateway), HighLevel (external CRM/calendar).

The app-specific product code is not yet implemented — this repo currently holds the base scaffold plus Supabase wiring. **The full architecture is designed in [docs/blueprint/](docs/blueprint/) — read it before planning or implementing any feature.**

## Blueprint — source of truth

Before making any change to this project:

1. Start with [docs/blueprint/MASTER_BLUEPRINT.md](docs/blueprint/MASTER_BLUEPRINT.md) — an index + executive summary linking every detailed document below. Then read the full documentation in [docs/blueprint/](docs/blueprint/) (`00-product.md` through `11-ui-ux.md`, plus [12-security-audit.md](docs/blueprint/12-security-audit.md) — a full architecture/security audit whose Critical/High findings are already merged into `00`–`11` —, [13-agent-engine.md](docs/blueprint/13-agent-engine.md) — the **official, must-not-change-without-justification** specification of the agent engine pipeline and its components —, and [14-design-system.md](docs/blueprint/14-design-system.md) — the visual identity/design tokens, already implemented as CSS custom properties in [src/app/globals.css](src/app/globals.css)).
2. Treat those documents as the project's source of truth for architecture, entities, and module boundaries.
3. Do not implement functionality that contradicts the Blueprint.
4. If you detect an inconsistency between the Blueprint and a request, raise it before writing code.
5. Reuse existing code whenever possible.
6. Keep the architecture modular and multi-tenant (see [docs/blueprint/03-modules.md](docs/blueprint/03-modules.md)).
7. Do not modify the database schema without justifying it against [docs/blueprint/02-database.md](docs/blueprint/02-database.md).
8. Before creating new tables or services, verify whether a reusable core solution already exists (see the "Reutilización explícita" notes in [06-crm.md](docs/blueprint/06-crm.md) and [07-ats.md](docs/blueprint/07-ats.md)).
9. Maintain compatibility with Next.js, Supabase, YCloud, OpenRouter, and HighLevel as documented in [docs/blueprint/08-integrations.md](docs/blueprint/08-integrations.md).
10. Briefly explain important architecture decisions before implementing them.

The Blueprint documents several open assumptions/gaps explicitly (flagged with ⚠️ or "supuesto" in each file, e.g. unconfirmed HighLevel OAuth2 scopes, unconfirmed YCloud webhook signature verification) — these must be resolved with the user before the affected implementation phase, not silently assumed away.

## Commands

- `npm run dev` — start the dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — run ESLint (flat config via [eslint.config.mjs](eslint.config.mjs))
- `npm run test` — run the Vitest unit test suite ([vitest.config.ts](vitest.config.ts))

Test coverage is still sparse (currently just `src/lib/integrations/ycloud.test.ts`) — most of the app has no tests yet.

## Environment setup

Copy [.env.local.example](.env.local.example) to `.env.local` and fill in values from the Supabase project (Project Settings > API):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by both browser and server Supabase clients.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, elevated privileges (e.g. WhatsApp webhook handlers, background jobs). Never expose to the browser.

`.env*` is gitignored — never commit real credentials.

## MCP servers

[.mcp.json](.mcp.json) configures:

- **supabase** — lets Claude Code inspect/manage the Supabase project directly. Reads `SUPABASE_ACCESS_TOKEN` from the shell environment (not committed) — export a Supabase personal access token before launching Claude Code. Pinned to the project via `--project-ref=hfcagkwqefilifprthau` in its `args`.
- **context7** — up-to-date library/framework documentation lookup (`@upstash/context7-mcp`, installed as a devDependency so the CLI binary is available locally without a network fetch on first use — run directly via `npx context7-mcp --help`). Works anonymously with rate limits; optionally export `CONTEXT7_API_KEY` (from context7.com) for higher limits.

## Architecture

- Next.js App Router — pages/layouts under [src/app/](src/app/), following the `page.tsx` / `layout.tsx` file convention.
- Path alias `@/*` maps to `src/*` (see [tsconfig.json](tsconfig.json)).
- Styling: Tailwind CSS v4 via `@tailwindcss/postcss` (see [postcss.config.mjs](postcss.config.mjs)), global styles in [src/app/globals.css](src/app/globals.css), dark mode via Tailwind's `dark:` variant.
- Fonts: Geist Sans and Geist Mono loaded via `next/font/google` in [src/app/layout.tsx](src/app/layout.tsx), exposed as CSS variables.
- TypeScript in `strict` mode with `noEmit` — type-checking happens through Next.js tooling, not a standalone `tsc` run.

### Supabase integration

Follows the standard `@supabase/ssr` App Router pattern — three separate client constructors, each scoped to its execution context:

- [src/lib/supabase/client.ts](src/lib/supabase/client.ts) — browser client, for Client Components.
- [src/lib/supabase/server.ts](src/lib/supabase/server.ts) — server client for Server Components/Actions/Route Handlers, backed by `next/headers` cookies.
- [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts) — `updateSession`, used by [src/middleware.ts](src/middleware.ts) (matches all routes except static assets/images) to refresh the auth token on every request and keep session cookies valid.

Do not read/write Supabase auth cookies manually outside these helpers — the split between client/server/middleware cookie handling is required by `@supabase/ssr` for sessions to stay in sync across Server Components, Client Components, and middleware.

### Deployment

Deploy target is Vercel; no project-specific `vercel.json` exists — standard Next.js zero-config deployment applies. Remember to set the same Supabase env vars in the Vercel project settings.
