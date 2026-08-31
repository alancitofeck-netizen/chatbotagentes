-- Sistema de onboarding + tours interactivos + aprendizaje. Dos tablas,
-- mismo patrón que notification_preferences (0081): member_id + clave única,
-- RLS "solo mi propia fila", ausencia de fila = estado por defecto (nunca
-- hace falta sembrar filas al crear el workspace/miembro).

-- El checklist inicial de 6 pasos ("Configuración de tu Growth Link").
create table public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  step_key text not null check (step_key in ('profile', 'whatsapp', 'manychat', 'calendar', 'crm', 'automations')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  updated_at timestamptz not null default now(),
  unique (member_id, step_key)
);

create index onboarding_progress_member_idx on public.onboarding_progress (member_id);

alter table public.onboarding_progress enable row level security;

create policy "onboarding_progress_select_own" on public.onboarding_progress
  for select using (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "onboarding_progress_insert_own" on public.onboarding_progress
  for insert with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "onboarding_progress_update_own" on public.onboarding_progress
  for update
  using (member_id in (select id from public.workspace_members where user_id = auth.uid()))
  with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));

-- Tabla genérica para todo lo demás del sistema de aprendizaje: tours de
-- producto por módulo, hints contextuales de "primera vez usando X", y la
-- marca de "módulo aprendido" (LearningProgress) — una sola tabla en vez de
-- tres casi idénticas, `kind` las distingue. `item_key` es el identificador
-- de negocio (p. ej. 'crm-create-lead' para un tour, 'crm-filters-first-use'
-- para un hint, 'crm' para un módulo marcado como aprendido).
create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  kind text not null check (kind in ('tour', 'hint', 'module')),
  item_key text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (member_id, kind, item_key)
);

create index learning_progress_member_idx on public.learning_progress (member_id);

alter table public.learning_progress enable row level security;

create policy "learning_progress_select_own" on public.learning_progress
  for select using (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "learning_progress_insert_own" on public.learning_progress
  for insert with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));

create policy "learning_progress_update_own" on public.learning_progress
  for update
  using (member_id in (select id from public.workspace_members where user_id = auth.uid()))
  with check (member_id in (select id from public.workspace_members where user_id = auth.uid()));
