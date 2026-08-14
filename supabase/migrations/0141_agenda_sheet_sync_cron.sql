-- Trigger real del sync de citas — mismo mecanismo pg_cron + pg_net que
-- 0084_lead_sheet_sync_cron.sql, misma cadencia (cada 2 min) y misma
-- sintaxis de 5 campos (pg_cron en este proyecto no acepta el alias
-- '<N> minutes').
--
-- El secreto NO se define acá (mismo convenio que el resto del proyecto) —
-- se inserta directo en Vault, fuera de banda, bajo el nombre
-- 'cron_sync_appointment_sheets_bearer', con el mismo valor que CRON_SECRET.
select cron.schedule(
  'sync-appointment-sheets',
  '*/2 * * * *',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/sync-appointment-sheets',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_appointment_sheets_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
