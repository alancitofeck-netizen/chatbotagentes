-- Enlaza módulos existentes al nuevo `clients` sin duplicar nada de lo que
-- ya guardan: todo aditivo (`add column if not exists`, FK nullable), cero
-- riesgo sobre RLS/datos existentes — ninguna fila pierde nada ni cambia
-- comportamiento para lo que ya funciona hoy.
--
-- OJO — dos relaciones DISTINTAS, no confundir:
--   clients.contact_id  → el contacto que ES el cliente pago (ancla 1:1,
--                          agregado en 0124).
--   contacts.client_id  → "este lead/prospecto se generó PARA el cliente
--                          X" (atribución, muchos contactos por cliente —
--                          los leads que ese cliente está recibiendo, no
--                          el cliente en sí).

alter table public.contacts add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists contacts_client_idx on public.contacts (workspace_id, client_id);

alter table public.mini_apps add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists mini_apps_client_idx on public.mini_apps (workspace_id, client_id);

alter table public.policies add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists policies_client_idx on public.policies (workspace_id, client_id);

alter table public.bookings add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists bookings_client_idx on public.bookings (workspace_id, client_id);

alter table public.tasks add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists tasks_client_idx on public.tasks (workspace_id, client_id);

-- Distingue "esperamos esto DEL cliente" vs "esto lo debemos NOSOTROS" sin
-- tocar el CHECK existente de tasks.status (pending/in_progress/completed,
-- 0016_tasks_enrichment.sql) ni inventar un estado "blocked" que no existe
-- en ningún lado del código hoy — es una dimensión ortogonal al estado, no
-- un estado nuevo. Null para cualquier tarea no vinculada a un cliente (la
-- inmensa mayoría de las tareas del sistema).
alter table public.tasks add column if not exists owner_side text
  check (owner_side is null or owner_side in ('client', 'growth_link'));

-- task_relations (panel de relaciones del detalle completo de tarea,
-- src/app/(protected)/tasks/[taskId]/tabs/ResumenTab.tsx) SÍ tiene un CHECK
-- real a diferencia de tasks.related_type/documents.related_type/
-- audit_log.entity_type (todos texto libre sin CHECK, 0002/0019/0020) — se
-- amplía para que "Cliente" pueda aparecer ahí como chip, igual que
-- Contacto/Oportunidad/etc hoy. 'client' como valor de related_type/
-- entity_type/doc_category en las demás tablas es simplemente un valor
-- nuevo reconocido en código de aplicación, cero migración adicional.
alter table public.task_relations drop constraint if exists task_relations_related_type_check;
alter table public.task_relations add constraint task_relations_related_type_check
  check (related_type in ('contact', 'conversation', 'opportunity', 'advisor_policy', 'event', 'document', 'client'));
