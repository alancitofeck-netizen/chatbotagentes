-- Baja la cadencia del cron de sync de Operaciones/Agenda de cada 2 min a
-- cada 15 min — cada corrida pega contra una función real de Vercel (pg_net
-- no la exime de invocaciones/CPU, a diferencia de lo que se asumía antes),
-- y el plan Hobby se quedó sin cupo (deployment pausado por Vercel). 15 min
-- sigue siendo "casi en vivo" para el caso de uso, con una fracción del
-- consumo.
select cron.unschedule('sync-advisor-sheets');

select cron.schedule(
  'sync-advisor-sheets',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://chatbotagentes.vercel.app/api/cron/sync-advisor-sheets',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_sync_advisor_sheets_bearer')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
