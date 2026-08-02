-- Centro de notificaciones global (Fase 1: infraestructura + eventos que ya
-- se disparan hoy en el código). Escrituras SIEMPRE vía
-- createServiceRoleClient() desde src/lib/notifications/service.ts — un
-- módulo nunca inserta una notificación "a nombre" de otro miembro pasando
-- por RLS del usuario actual, mismo motivo por el que no hay policy de
-- INSERT acá (igual que mini_app_leads/ingest.ts). Lectura/escritura del
-- estado (leída/eliminada) sí pasa por RLS normal: cada miembro solo puede
-- tocar sus propias filas, mismo patrón que conversation_reads (0014).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  category text not null check (category in ('crm', 'inbox', 'calendario', 'automatizaciones', 'agentes', 'ia', 'sistema')),
  event_type text not null,
  priority text not null check (priority in ('info', 'success', 'warning', 'error')),
  title text not null,
  message text not null,
  action_url text,
  metadata jsonb not null default '{}',
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_member_unread_idx on public.notifications (member_id, read, created_at desc);
create index notifications_workspace_idx on public.notifications (workspace_id);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "notifications_update_own" on public.notifications
  for update
  using (member_id in (select id from public.workspace_members where user_id = auth.uid()))
  with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "notifications_delete_own" on public.notifications
  for delete using (member_id in (select id from public.workspace_members where user_id = auth.uid()));
