-- KPIs module sync trigger — same pg_cron + pg_net mechanism as
-- 0029_pgcron_buffer_flush.sql/0030_pgcron_buffer_flush_fix.sql (net.http_get,
-- not _post — the route only exports GET, matching Vercel Cron's own
-- convention). vercel.json's daily entry for /api/cron/sync-kpis is only a
-- Hobby-plan-compatible safety net; this is the real ~3-minute trigger.
--
-- The bearer secret is NOT set here (same convention as every other
-- credential in this project) — insert it directly into Vault once, out of
-- band, under the name 'cron_sync_kpis_bearer', matching the value of the
-- CRON_SECRET env var (src/app/api/cron/sync-kpis/route.ts checks the same
-- header either trigger sends).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-kpi-sheets',
  '3 minutes',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/sync-kpis',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_kpis_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
