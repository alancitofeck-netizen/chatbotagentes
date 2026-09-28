-- Tracking de embudo para Mini Apps (Fase 1 del rediseño de Resumen/Analíticas):
-- visitas ya se cuentan en mini_app_visits y los leads en mini_app_leads, pero
-- no hay ningún registro de los pasos intermedios (empezó a llenar el
-- formulario, vio tal paso, completó la simulación) que el embudo del mockup
-- necesita. Igual que mini_app_visits/mini_app_leads: el único escritor real
-- es un endpoint público (POST /api/public/mini-apps/[slug]/track) que
-- siempre usa service_role, por eso no hay policy de insert acá.
create table public.mini_app_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  mini_app_id uuid not null references public.mini_apps (id) on delete cascade,
  -- Generado en el navegador (no hay auth para un visitante anónimo) — sirve
  -- para no contar el mismo paso dos veces dentro de la misma visita si el
  -- futuro instrumentado de cada plantilla lo necesita, pero no es una
  -- garantía fuerte de unicidad (no hay índice único sobre esto).
  session_id text not null,
  event_type text not null check (event_type in ('app_opened', 'step_viewed', 'simulation_completed', 'lead_submitted')),
  step int,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index mini_app_events_app_created_idx on public.mini_app_events (mini_app_id, created_at desc);
create index mini_app_events_app_session_idx on public.mini_app_events (mini_app_id, session_id);

alter table public.mini_app_events enable row level security;

create policy "mini_app_events_select" on public.mini_app_events
  for select using (core.is_workspace_member(workspace_id));
