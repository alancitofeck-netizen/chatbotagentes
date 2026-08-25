-- Fase 9 (Análisis del asesor): analiza los mensajes REALES que un asesor
-- escribió (messages.sender_type='agent', sender_id=su workspace_members.id
-- — nunca inventado) y persiste un perfil de comunicación/proceso comercial
-- reusable por cualquier ai_agents ligado a ese advisor_id.
--
-- Confirmado en vivo antes de escribir esto: los ai_agents reales (y
-- asesoria_referrals) viven en el workspace COMPARTIDO de la agencia (varios
-- miembros reales: 1 owner + N admin), no en un workspace individual por
-- asesor — advisor_id sí discrimina entre miembros reales distintos
-- (Carlos, Cecilia, etc.) que comparten el mismo workspace_id.
create table public.advisor_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null = perfil "genérico del workspace" (agrega sender_type='agent' de
  -- cualquier miembro) — mismo fallback que ai_agents.advisor_id null.
  advisor_id uuid references public.workspace_members (id) on delete cascade,
  communication_style text,
  tone text,
  message_length text,
  emoji_usage text,
  questioning_style text,
  sales_process text[] not null default '{}',
  objection_handling text,
  follow_up_style text,
  appointment_style text,
  learned_patterns text[] not null default '{}',
  analyzed_message_count int not null default 0,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un perfil por (workspace, advisor) — y como advisor_id puede ser null,
-- dos índices únicos parciales en vez de un unique() compuesto (Postgres
-- trata cada NULL como distinto, permitiría infinitos perfiles "genéricos").
create unique index advisor_profiles_workspace_advisor_idx on public.advisor_profiles (workspace_id, advisor_id) where advisor_id is not null;
create unique index advisor_profiles_workspace_null_advisor_idx on public.advisor_profiles (workspace_id) where advisor_id is null;

alter table public.advisor_profiles enable row level security;

create policy advisor_profiles_select on public.advisor_profiles
  for select using (core.is_workspace_member(workspace_id));
create policy advisor_profiles_insert on public.advisor_profiles
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy advisor_profiles_update on public.advisor_profiles
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy advisor_profiles_delete on public.advisor_profiles
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
