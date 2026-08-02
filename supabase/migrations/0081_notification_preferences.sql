-- Fase 3 del sistema de notificaciones: preferencias por categoría × medio.
-- Ausencia de fila = default (enabled=true, email=false, push=false) — mismo
-- convenio que workspace_modules (docs/blueprint/03-modules.md), así que no
-- hace falta sembrar una fila por miembro×categoría al crear el workspace.
-- `push` ya vive en el esquema desde ahora aunque la Fase 4 (push del
-- navegador) todavía no lo lee — evita otra migración solo para agregar una
-- columna boolean más adelante.

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  category text not null check (category in ('crm', 'inbox', 'calendario', 'automatizaciones', 'agentes', 'ia', 'sistema')),
  enabled boolean not null default true,
  email boolean not null default false,
  push boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (member_id, category)
);

create index notification_preferences_member_idx on public.notification_preferences (member_id);

alter table public.notification_preferences enable row level security;

-- Mismo patrón "solo mi propia fila" que conversation_reads (0014) — acá
-- además hay policy de INSERT propia porque, a diferencia de `notifications`
-- (que solo escribe el servicio centralizado), esta tabla la gestiona
-- directamente cada usuario desde Perfil > Preferencias.
create policy "notification_preferences_select_own" on public.notification_preferences
  for select using (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "notification_preferences_update_own" on public.notification_preferences
  for update
  using (member_id in (select id from public.workspace_members where user_id = auth.uid()))
  with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "notification_preferences_delete_own" on public.notification_preferences
  for delete using (member_id in (select id from public.workspace_members where user_id = auth.uid()));
