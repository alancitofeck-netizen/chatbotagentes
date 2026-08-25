-- Cierre de la decisión pendiente de la Fase 4 (Agentes IA de Referidos):
-- el disparo real de referral_followups (0167) crea una TAREA para el
-- asesor en el módulo de Tareas ya existente — nunca reintenta solo
-- mandando un segundo mensaje. Reusa `tasks`/`task_relations` tal cual, sin
-- ningún sistema de tareas paralelo.

-- 1. task_relations: sumar 'referral' al CHECK ya existente (contact/
-- conversation/opportunity/advisor_policy/event/document/client) — mismo
-- patrón drop/add usado en todo el proyecto para ampliar CHECKs.
alter table public.task_relations drop constraint if exists task_relations_related_type_check;
alter table public.task_relations add constraint task_relations_related_type_check
  check (related_type in ('contact', 'conversation', 'opportunity', 'advisor_policy', 'event', 'document', 'client', 'referral'));

-- 2. Arquitectura preparada para el modo "Automático" (pedido explícito:
-- dejar la columna lista, NO implementar el envío automático todavía). Por
-- ahora el cron solo respeta 'manual' — 'automatic' queda seteable a nivel
-- de dato pero sin ninguna UI que lo exponga ni ninguna lógica que lo use
-- de verdad, para no fingir una funcionalidad que no está implementada.
alter table public.ai_agents add column if not exists referral_followup_mode text not null default 'manual'
  check (referral_followup_mode in ('manual', 'automatic'));

-- 3. Programa /api/cron/referral-followups vía pg_cron + pg_net, mismo
-- mecanismo y mismo secreto de Vault ya reusado por policy-automations
-- (0094) — cada intento programado (referral_followups.scheduled_at) es
-- del orden de días, así que una corrida por hora da margen de sobra.
select cron.schedule(
  'referral-followups-check',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://chatbotagentes.vercel.app/api/cron/referral-followups',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_flush_buffers_bearer'),
      'Content-Type', 'application/json'
    )
  );
  $$
);
