-- El evento nuevo collection_payment_reminder (catalog.ts) usa
-- category='cobranza', pero ni notifications ni notification_preferences
-- tenían esa categoría en su CHECK — mismo bug de 0090/0091/0093
-- (constraint no ampliado al agregar un módulo nuevo), corregido en la
-- misma migración esta vez.

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('crm', 'inbox', 'calendario', 'automatizaciones', 'agentes', 'ia', 'sistema', 'polizas', 'cobranza'));

alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences add constraint notification_preferences_category_check
  check (category in ('crm', 'inbox', 'calendario', 'automatizaciones', 'agentes', 'ia', 'sistema', 'polizas', 'cobranza'));

-- Programa /api/cron/collection-automations vía pg_cron + pg_net, mismo
-- mecanismo horario que policy-automations (0094) — la granularidad del
-- trigger es "días", una corrida por hora da margen de sobra.
select cron.schedule(
  'collection-automations-check',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://chatbotagentes.vercel.app/api/cron/collection-automations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_flush_buffers_bearer'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
