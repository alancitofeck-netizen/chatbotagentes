-- Programa /api/cron/policy-automations (0092/route.ts) vía pg_cron + pg_net,
-- mismo mecanismo que flush-buffers/sync-lead-sheets (no sujeto a los
-- límites de Cron Jobs de Vercel). Frecuencia horaria: a diferencia del
-- flush de buffers (segundos) o los recordatorios de reunión (minutos), acá
-- la granularidad del trigger es "días", así que correr una vez por hora ya
-- da margen de sobra sin generar carga innecesaria.
--
-- Reusa el secreto de Vault 'cron_flush_buffers_bearer' en vez de crear uno
-- nuevo: todos los endpoints de cron de este proyecto validan contra el
-- mismo valor de CRON_SECRET (ver flush-buffers/route.ts), así que un
-- secreto por endpoint es solo una convención de nombre, no aislamiento real
-- — reusar evita pedirle al usuario que inserte un secreto nuevo en Vault
-- para esto.
select cron.schedule(
  'policy-automations-check',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://chatbotagentes.vercel.app/api/cron/policy-automations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_flush_buffers_bearer'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
