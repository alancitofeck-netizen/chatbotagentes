-- Switches the Buffer Inteligente flush trigger from Vercel Cron ("Diseño B",
-- src/app/api/cron/flush-buffers/route.ts) to pg_cron + pg_net ("Diseño A",
-- docs/blueprint/04-inbox.md's original design: "pg_cron, cada 3-5s"). Not
-- a workaround — this is the Blueprint's intended mechanism, shipped as a
-- fallback earlier only because pg_cron/pg_net availability on this Supabase
-- project was unconfirmed at the time. Trigger for switching now: Vercel's
-- Hobby plan only allows daily Cron Jobs, which would have made the buffer
-- flush effectively once-a-day — pg_cron runs entirely inside Postgres and
-- isn't subject to that (or any Vercel plan) restriction at all.
--
-- `processClaimedBuffer` (src/lib/ai/bufferDispatch.ts) is unchanged — this
-- only changes what calls the existing /api/cron/flush-buffers route.
--
-- The bearer secret is intentionally NOT set here: this file only creates
-- the schedule referencing it BY NAME from Vault. The actual secret value
-- is inserted once, directly (not via a migration that would commit it to
-- git) — same convention as every other credential in this project (never
-- a literal secret in a migration file).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'flush-conversation-buffers',
  '15 seconds',
  $$
  select net.http_post(
    url := 'https://chatbotagentes.vercel.app/api/cron/flush-buffers',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_flush_buffers_bearer'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
