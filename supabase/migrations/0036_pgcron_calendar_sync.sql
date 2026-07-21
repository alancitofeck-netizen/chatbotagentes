-- Google Calendar → CRM automatic sync trigger — same pg_cron + pg_net
-- mechanism as flush-buffers (0029/0030) and sync-kpis (0034): net.http_get
-- (not _post — the route only exports GET), a Vault secret referenced by
-- name, 3-minute cadence. vercel.json's daily entry for
-- /api/cron/sync-calendar is only a Hobby-plan-compatible safety net.
--
-- The bearer secret is NOT set here (same convention as every other
-- credential in this project) — insert it directly into Vault once, out of
-- band, under the name 'cron_sync_calendar_bearer', matching the value of
-- the CRON_SECRET env var (src/app/api/cron/sync-calendar/route.ts checks
-- the same header either trigger sends).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-google-calendar',
  '*/3 * * * *',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/sync-calendar',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_calendar_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
