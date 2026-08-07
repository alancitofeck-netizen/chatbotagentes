-- Programa /api/cron/run-automations (0108/route.ts) vía pg_cron + pg_net,
-- mismo mecanismo que policy-automations/collection-automations (no sujeto a
-- los límites de Cron Jobs de Vercel). Minuto 30 para no pisar los otros dos
-- crons horarios de automatizaciones (minuto 0 y 15).
select cron.schedule(
  'run-automations-check',
  '30 * * * *',
  $$
  select net.http_post(
    url := 'https://chatbotagentes.vercel.app/api/cron/run-automations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_flush_buffers_bearer'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
