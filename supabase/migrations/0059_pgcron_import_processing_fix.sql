-- Fixes a real bug in 0057_pgcron_import_processing.sql, found by checking
-- net._http_response after the "Importador de Cartera" deploy: every one of
-- the job's 10-second ticks was returning HTTP 405, because
-- /api/cron/process-imports only exports a GET handler (matching Vercel
-- Cron's own convention, and the identical convention already used by
-- flush-buffers/sync-kpis) while the pg_cron job called net.http_post — the
-- exact same class of bug already found and fixed once before for
-- flush-conversation-buffers (see 0030_pgcron_buffer_flush_fix.sql). Switches
-- to net.http_get. Also raises the request timeout from pg_net's 5s default
-- to 30s, same reasoning as 0030: this route's own `maxDuration = 60` can
-- process several state-machine phases per invocation (up to 3 inserts per
-- policy row), which can genuinely take longer than 5s.
--
-- Net effect confirmed before this fix: the background import engine has
-- never actually advanced a single job via the real pg_cron mechanism —
-- 100% of ticks failed silently with 405. Any prior "progress" observed
-- (e.g. the 10k-row test) came from manually/scripted calls to the route,
-- not from this cron job.

select cron.unschedule('process-cartera-imports');

select cron.schedule(
  'process-cartera-imports',
  '10 seconds',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/process-imports',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_process_imports_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
