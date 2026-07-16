-- Fixes a real bug in 0029_pgcron_buffer_flush.sql, found by checking
-- net._http_response after applying it: every tick returned HTTP 405,
-- because /api/cron/flush-buffers only exports a GET handler (matching
-- Vercel Cron's own convention of GETting the configured path) while the
-- pg_cron job called net.http_post. Switches to net.http_get. Also raises
-- the request timeout from pg_net's 5s default to 30s — the route's own
-- `maxDuration = 60` allows it to process up to 10 claimed buffers per
-- invocation (LLM calls included), which can genuinely take longer than 5s.

select cron.unschedule('flush-conversation-buffers');

select cron.schedule(
  'flush-conversation-buffers',
  '15 seconds',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/flush-buffers',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_flush_buffers_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
