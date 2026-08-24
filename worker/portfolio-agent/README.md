# portfolio-agent

Standalone, host-agnostic Node service that runs Playwright browser
automation to log into an advisor's insurance-portal account and sync their
policy portfolio into Growth Link — the "Agente IA de Cartera" feature.
Independent of the Next.js app's Vercel deployment, which cannot host
long-lived browser processes. Sibling project to `worker/whatsapp-connector/`
(same overall pattern), NOT the same service — separate Docker container,
separate env vars, separate ports.

## Architecture

Mirrors `worker/whatsapp-connector/`'s split between a library-agnostic core
and a single concrete implementation:

- **`src/portalAdapter.ts`** — the `PortalAdapter` interface (`login`,
  `navigateToPolicies`, `getPolicyList`, `getPolicyDetails`, `hasNextPage`,
  `nextPage`, `logout`) plus shared limits (timeout/maxPages/maxPolicies/
  maxRetries/delay). Zero imports from Playwright itself beyond the `Page`
  type.
- **`src/adapters/generic/GenericTestAdapter.ts`** — the ONLY adapter that
  exists right now. It is a generic, portal-agnostic implementation (login
  form + HTML table + "Siguiente"/"Next" pagination, using accessible
  role/label locators, never brittle CSS classes) meant to validate the
  whole pipeline end-to-end against a simple test page — **not** a real
  adapter for any specific insurer. A real adapter (GNP, MetLife, ...) needs
  that insurer's actual portal URL/login flow/field layout, which nobody has
  provided yet — see the plan this was built from (`witty-popping-frog.md`)
  for why that's deliberately out of scope for this pass.
- **`src/jobManager.ts`** / **`src/controlApi.ts`** — depend only on
  `PortalAdapter`, never on Playwright/a specific portal directly. Adding a
  real adapter later means writing a class implementing `PortalAdapter` and
  keying it off `insurance_providers.key` in `jobManager.ts` — nothing else
  changes.
- **`src/browserManager.ts`** — one shared Playwright `Browser`, one
  isolated `BrowserContext` (cookies/storage never shared) per job — closed
  and cleaned up unconditionally when the job ends, cancels, or errors.

## Why this exists

A real insurer portal login needs a real Chromium browser and can take
minutes to page through a full policy list — nothing Vercel's serverless
functions can hold. This worker is that always-on process.

## How a sync job actually works

1. Growth Link creates an `insurance_sync_jobs` row (`status: 'queued'`) and
   calls `POST /jobs` on this worker with `{ jobId, workspaceId,
   connectionId }` — **never** the portal username/password in that
   request. This worker resolves credentials itself via the
   `get_portal_credentials(connectionId)` Postgres RPC (`service_role`-only,
   see `supabase/migrations/0162_portfolio_agent.sql`), the same way it
   never sees Growth Link's own Supabase session token either.
2. `jobManager.ts` runs the job in the background (the `POST /jobs` call
   returns immediately once the job is accepted, not once it finishes) and
   reports progress by POSTing events to Growth Link's
   `/api/webhooks/portfolio-agent` — `progress` (step/processed/total),
   `policy_extracted` (one normalized policy at a time — Growth Link does
   the actual contact-matching and `policies` upsert on receipt, not this
   worker), `completed`, `failed`, `cancelled`, `requires_user_action`.
3. Between every page of results, the job checks
   `insurance_sync_jobs.cancel_requested` (set by
   `POST /jobs/:jobId/cancel`) and stops cleanly instead of being killed.
4. If the portal ever demands MFA/a CAPTCHA/manual verification, the
   adapter returns `requiresUserAction` instead of trying to bypass
   anything — the job stops and Growth Link surfaces that to the user.

## Configuration

All required env vars (the process fails fast at boot if any are missing):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Same Supabase project the Next.js app uses. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — used only to call `get_portal_credentials` and read `cancel_requested`. |
| `PORTFOLIO_WORKER_SECRET` | Shared secret Growth Link presents when calling this worker's control API (`/jobs`, `/jobs/:id/cancel`). |
| `PORTFOLIO_WORKER_WEBHOOK_SECRET` | Shared secret this worker presents when POSTing progress/results to Growth Link's `/api/webhooks/portfolio-agent`. |
| `NEXT_APP_URL` | Base URL of the Next.js app (e.g. `https://www.growthlink.uk`). |
| `PORT` | HTTP port for the control API (default `8081` — deliberately different from whatsapp-connector's `8080` default, to avoid a clash if both are ever run bare-metal on one host without Docker). |
| `PORTFOLIO_WORKER_MAX_CONCURRENCY` | Max sync jobs running at once (default `1`) — each is a real Chromium browser context, meaningfully heavier than a WhatsApp Web session; see "Production notes". |
| `LOG_LEVEL` | Not yet wired to a structured logger (this worker uses plain `console.log`/`console.error`, unlike whatsapp-connector's pino) — reserved for when one is added. |

## Control API

All routes below (except `/healthz`) require `Authorization: Bearer
$PORTFOLIO_WORKER_SECRET`.

- `GET /healthz` — liveness check + `runningJobs` count, no auth.
- `POST /jobs` — body `{ jobId, workspaceId, connectionId }`. Returns `503`
  if `PORTFOLIO_WORKER_MAX_CONCURRENCY` is already reached.
- `POST /jobs/:jobId/cancel` — sets `cancel_requested`; the running job
  notices on its next page-boundary check, not instantly.

## Production notes

- **Per-job cost is real and higher than a WhatsApp Web session**: each
  running job holds a full Chromium `BrowserContext` doing real page
  navigation, not an idle socket. Start `PORTFOLIO_WORKER_MAX_CONCURRENCY`
  at `1` and measure actual RAM/CPU on the target VPS before raising it —
  especially if this container is going to share a host with
  `worker/whatsapp-connector/`, whose own sessions already carry real
  Chromium/Puppeteer overhead per connected member.
- **No session persistence, no resume-on-boot**: unlike whatsapp-connector
  (which must resume every connected session after a restart or every
  member would need to re-scan a QR code), a sync job that's interrupted by
  a worker restart simply stays in whatever state it last reported —
  visible as an incomplete/failed run in the job history. The user re-runs
  the sync manually. There is deliberately no persistence/resume machinery
  here yet.
- **One job's failure can't be a single point of failure**: same
  `unhandledRejection`/`uncaughtException` handlers as whatsapp-connector —
  log and keep the process alive, never let one job's Playwright/protocol
  hiccup take down every other workspace's job.
- **Browser version pinning**: this Dockerfile uses Playwright's own
  official image (`mcr.microsoft.com/playwright:vX.Y.Z-jammy`), which ships
  browsers already matched to that exact Playwright version — the image tag
  and the `"playwright"` version in `package.json` must be bumped together,
  never independently (see the Dockerfile's own comment).

## Local development

```bash
npm install
npx playwright install --with-deps chromium   # only needed outside Docker — the Docker image already has it
npm run build
node --env-file=.env dist/index.js
```

## Adding a real portal adapter

1. Get the real portal's URL, login flow (screenshots or a walkthrough),
   field layout for the policy list and detail view, and pagination
   mechanism from the user — **do not guess this**, per the plan this
   worker was built from.
2. Add a new file under `src/adapters/<insurer-key>/` implementing
   `PortalAdapter` (`GenericTestAdapter.ts` is the template — start from a
   copy, don't build from scratch).
3. In `jobManager.ts`, replace the hardcoded `new GenericTestAdapter()`
   with a lookup keyed by `insurance_providers.key` (join through
   `insurance_connections.provider_id`), so each insurer's connection uses
   its own adapter.
4. Fill in `insurance_providers.portal_domain` for that insurer via a
   migration (the connect-portal UI in Growth Link blocks connecting until
   this is set) — the exact real domain, never a wildcard/guess.
