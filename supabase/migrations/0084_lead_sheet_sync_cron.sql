-- Trigger real del sync de leads — mismo mecanismo pg_cron + pg_net que
-- 0080_notifications_phase2_cron.sql. pg_cron en este proyecto solo acepta
-- sintaxis cron de 5 campos o el alias de segundos '[1-59] seconds' (no
-- '<N> minutes' — confirmado en esta misma sesión), de ahí '*/2 * * * *' en
-- vez de un alias de minutos.
--
-- El secreto NO se define acá (mismo convenio que el resto del proyecto) —
-- se inserta directo en Vault, fuera de banda, bajo el nombre
-- 'cron_sync_lead_sheets_bearer', con el mismo valor que CRON_SECRET.
select cron.schedule(
  'sync-lead-sheets',
  '*/2 * * * *',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/sync-lead-sheets',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_lead_sheets_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
