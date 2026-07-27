# whatsapp-connector

Standalone, host-agnostic Node service that holds persistent WhatsApp Web
sessions for Growth Link — one per connected workspace member. Independent
of the Next.js app's Vercel deployment, which cannot host long-lived
connections. See `docs/blueprint/08-integrations.md` and the main repo's
`CLAUDE.md` for the overall architecture this plugs into.

## Architecture

This worker never lets the rest of the codebase — nor even most of its own
files — depend on a specific WhatsApp library:

- **`src/whatsAppService.ts`** — the `WhatsAppService` interface (start,
  logout, stop, isRunning, runningCount, sendText, shutdownAll) and its event
  callbacks (`onQr`/`onReady`/`onDisconnected`/`onInboundMessage`/`onMessageAck`).
  Zero imports from any WhatsApp library.
- **`src/providers/whatsAppWebJsProvider.ts`** — the only file that imports
  `whatsapp-web.js`. Implements `WhatsAppService` on top of it.
- **`src/sessionManager.ts`** / **`src/controlApi.ts`** — depend only on
  `WhatsAppService`, never on `whatsapp-web.js` directly.

Swapping the underlying library later (Baileys, Meta's Cloud API) means
writing a new class implementing `WhatsAppService` and changing the single
`new WhatsAppWebJsProvider()` line in `src/index.ts` — nothing else in this
worker, and nothing in the Next.js app (which only ever talks to this worker
over HTTP), needs to change.

## Why this exists

`whatsapp-web.js` (like Baileys before it) requires an always-connected
process per session — Vercel serverless functions terminate after each
request/cron tick and cannot hold one. This service is that always-on
process, deployable to Railway, Fly.io, a plain VPS, or anywhere else that
runs a Docker container — purely via environment variables, no code changes
needed per target.

`whatsapp-web.js` specifically drives a real headless Chromium per session
via Puppeteer — a real operational cost per connected member (see
"Production notes" below), accepted as a deliberate choice over Baileys.

## Session persistence

`whatsapp-web.js`'s `RemoteAuth` strategy zips the entire Chromium profile
directory into one file and hands it to a pluggable `Store`
(`sessionExists`/`save`/`extract`/`delete`). `src/store/supabaseStorageStore.ts`
implements that `Store` by encrypting the zip (AES-256-GCM, a per-session key
resolved once via the `get_whatsapp_web_session_key` RPC and cached in
memory) and storing it as one object in the private Supabase Storage bucket
`whatsapp-web-sessions` — never in a Postgres table (that shape doesn't fit
a binary blob well), and never accessible to any client role, only this
worker's service-role key.

## Configuration

All required env vars (the process fails fast at boot if any are missing):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Same Supabase project the Next.js app uses. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — bypasses RLS, same trust level as the Next.js app's own `createServiceRoleClient()`. |
| `WHATSAPP_WEB_WORKER_SECRET` | Shared secret Next.js presents when calling this worker's control API (start/logout/send). |
| `WHATSAPP_WEB_WEBHOOK_SECRET` | Shared secret this worker presents when POSTing inbound messages/status to the Next.js app's `/api/webhooks/whatsapp-web`. |
| `NEXT_APP_URL` | Base URL of the Next.js app (e.g. `https://www.growthlink.uk`). |
| `PORT` | HTTP port for the control API (default `8080`). |
| `WHATSAPP_WEB_MAX_SESSIONS` | Max sessions this process will run concurrently (default `5`) — each is a real Chromium process; see "Production notes". |
| `LOG_LEVEL` | Pino log level (default `info`). |

## Control API

All routes below (except `/healthz`) require `Authorization: Bearer
$WHATSAPP_WEB_WORKER_SECRET`.

- `GET /healthz` — liveness check, no auth.
- `POST /sessions/:sessionId/start` — body `{ workspaceId, memberId, resume }`. Starts or resumes a session; whether a QR is generated or the session resumes silently is decided by what's already stored in the `whatsapp-web-sessions` Storage bucket, not by `resume` (informational only). Returns `503` if `WHATSAPP_WEB_MAX_SESSIONS` is already reached.
- `POST /sessions/:sessionId/logout` — real logout (unlinks the device, deletes the persisted Storage blob). Idempotent.
- `POST /sessions/:sessionId/send` — body `{ to, body }`. Requires the session to have an active client in this process.

## Boot behavior

On startup, resumes every session with status `connected`/`connecting`/
`qr_pending` from the database, in small staggered batches (a few at a time
with a short delay between batches) rather than all at once — each resume
now launches a real Chromium process, so an unstaggered boot with many
connected sessions would be a thundering herd of simultaneous browser
launches.

## Production notes

- **Per-session cost**: each session is a real Chromium process (~150–300MB+
  RAM as an initial planning figure — measure with real accounts before
  sizing a deployment). `WHATSAPP_WEB_MAX_SESSIONS` exists specifically so
  connecting more members than a container can hold degrades to a clear
  `503` on new connects rather than an OOM-killing every session at once.
- **Graceful shutdown**: `SIGTERM`/`SIGINT` tear down every session's
  Chromium (`stop()`, not `logout()`) before exiting — never invalidates the
  remote WhatsApp session, and avoids orphaned browser processes.
- **One session's failure can't be a single point of failure**: whatsapp-web.js/Puppeteer
  can throw raw, unhandled protocol errors (e.g. `Execution context was
  destroyed` — a well-documented community issue, see below) from deep
  inside one session's Chromium instance. `index.ts` installs
  `unhandledRejection`/`uncaughtException` handlers that log and keep the
  process alive, so one session's internal hiccup never takes down every
  other connected workspace's session.
- **Chrome version pairing matters — never rely on an arbitrary system Chrome**:
  `puppeteer` (a dependency of `whatsapp-web.js`) manages its OWN Chrome
  build via its normal `npm install` postinstall (`npx puppeteer browsers
  install chrome`, downloading into `PUPPETEER_CACHE_DIR`) — this is what
  guarantees the browser version always matches what's actually resolved in
  `package-lock.json`, identically in local dev and in the Docker image.
  Do **not** set `PUPPETEER_SKIP_DOWNLOAD`/`PUPPETEER_EXECUTABLE_PATH` in
  this project's own config to point at a pre-existing system Chrome
  instead — during development, launching against an arbitrary
  locally-installed Chrome (a different, unmatched version) reliably
  reproduced `Execution context was destroyed` during the initial page
  injection, a widely-reported `whatsapp-web.js`/Puppeteer version-mismatch
  issue, not a bug in this worker's code. `ghcr.io/puppeteer/puppeteer` is
  still the base image (it bundles all the system libraries Chrome needs,
  avoiding a fragile hand-rolled `apt-get` list) — but this build does not
  reuse *that image's own* pre-installed Chrome, precisely because it isn't
  guaranteed to match this project's resolved `puppeteer` version either.
  `webVersionCache: { type: 'none' }` (set in `whatsAppWebJsProvider.ts`) is
  also applied, since a stale bundled WhatsApp Web version is a second,
  independent common cause of the same symptom.

## Local development

```bash
npm install
npm run build
node --env-file=.env dist/index.js
```

A plain `npm install` (no `PUPPETEER_SKIP_DOWNLOAD`) downloads a
version-matched Chrome the same way the Dockerfile does, so local behavior
matches production. **Known issue on at least one Windows dev machine used
for this project**: `puppeteer`'s postinstall download script can crash
natively (exit code `0xC0000142`) — the same pre-existing, environment-level
crash already seen with other spawned Node child processes on that machine
(e.g. Turbopack), unrelated to this worker's code. If you hit this, it's a
local-machine problem to work around (retry, check antivirus/EDR
interference with newly-downloaded executables), not something to "fix" by
adding `PUPPETEER_SKIP_DOWNLOAD` back into `package.json`/`Dockerfile` — that
would silently reintroduce the exact dev/prod inconsistency this section
warns against. A real Linux Docker build is unaffected (that crash code is
Windows-specific).
