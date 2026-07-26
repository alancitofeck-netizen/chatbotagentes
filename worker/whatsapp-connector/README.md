# whatsapp-connector

Standalone, host-agnostic Node service that holds persistent WhatsApp Web
(Baileys) sessions for Growth Link — one per connected workspace member.
Independent of the Next.js app's Vercel deployment, which cannot host a
long-lived socket connection. See `docs/blueprint/08-integrations.md` and the
main repo's `CLAUDE.md` for the overall architecture this plugs into.

## Why this exists

Both `whatsapp-web.js` and Baileys require an always-connected process per
session — Vercel serverless functions terminate after each request/cron tick
and cannot hold one. This service is that always-on process, deployable to
Railway, Fly.io, a plain VPS, or anywhere else that runs a Docker container —
purely via environment variables, no code changes needed per target.

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
| `LOG_LEVEL` | Pino log level (default `info`). |

Locally, run with `node --env-file=.env dist/index.js` (Node 20.6+) — no
`dotenv` dependency needed.

## Dependency note

Pinned to `@whiskeysockets/baileys@7.0.0-rc13` (a pre-1.0 release candidate),
not the `legacy` 6.7.x line — 6.7.x depends on `libsignal-node` via a git
URL, which fails to install in any environment without SSH access to GitHub
(including a plain `docker build`, which has none by design). 7.0.0-rc13
depends on the real npm-published `libsignal` package instead, so it's the
only currently-installable option for a Dockerized deployment. Revisit this
pin once a non-RC 7.x lands.

## Control API

All routes below (except `/healthz`) require `Authorization: Bearer
$WHATSAPP_WEB_WORKER_SECRET`.

- `GET /healthz` — liveness check, no auth.
- `POST /sessions/:sessionId/start` — body `{ workspaceId, memberId, resume }`. Starts or resumes a session; whether a QR is generated or the session resumes silently is decided by what's already stored in `whatsapp_web_credentials`, not by `resume` (which is informational only).
- `POST /sessions/:sessionId/logout` — real Baileys logout (unlinks the device). Idempotent.
- `POST /sessions/:sessionId/send` — body `{ to, body }`. Requires the session to have an active, connected socket in this process.

## Boot behavior

On startup, resumes every session with status `connected`/`connecting`/
`qr_pending` from the database — a redeploy/restart must never force a
member to re-scan a QR code.

## Local development

```bash
npm install
npm run build   # or: npm run dev (tsx, no build step)
node --env-file=.env dist/index.js
```
