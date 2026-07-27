-- Importador de Cartera (Fase 1) — drives /api/cron/process-imports at a
-- steady cadence, same pg_cron+pg_net mechanism as 0029 (buffer flush) and
-- 0034 (KPI sync): entirely inside Postgres, not subject to Vercel's Hobby
-- plan Cron Job restrictions (vercel.json's own entry for this route is a
-- once-daily safety net only, per CLAUDE.md's Deployment section).
--
-- 10-second cadence — faster than KPI sync's 3 minutes (this is a
-- foreground wizard the user is actively watching progress on), slower than
-- the buffer flush's 15 seconds (each tick here can do meaningfully more
-- writework per claimed row: up to 3 inserts for a policy row).
--
-- The bearer secret is intentionally NOT set here (same convention as 0029):
-- this file only references it BY NAME from Vault. Run once, separately,
-- reusing the exact same value already stored for 'cron_flush_buffers_bearer'
-- / 'cron_sync_kpis_bearer' (all three routes check the same
-- process.env.CRON_SECRET):
--   select vault.create_secret('<the CRON_SECRET value>', 'cron_process_imports_bearer');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'process-cartera-imports',
  '10 seconds',
  $$
  select net.http_post(
    url := 'https://chatbotagentes.vercel.app/api/cron/process-imports',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_process_imports_bearer'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
