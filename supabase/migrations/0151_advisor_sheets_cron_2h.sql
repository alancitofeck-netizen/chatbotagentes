-- Consumo mínimo posible: baja el cron de sync de cada 15 min a cada 2
-- horas — la vía rápida para cambios que no pueden esperar sigue siendo
-- "Sincronizar ahora" (botón manual en Perfil → Integraciones), que llama
-- exactamente al mismo runAdvisorSheetSync sin pasar por este cron.
select cron.unschedule('sync-advisor-sheets');

select cron.schedule(
  'sync-advisor-sheets',
  '0 */2 * * *',
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
