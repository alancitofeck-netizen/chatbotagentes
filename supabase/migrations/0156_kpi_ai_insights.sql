-- Cache de resultados del AI Manager (Asesores -> Performance) — sin esto,
-- cada carga de la pestaña dispararía una llamada nueva a OpenRouter, sin
-- límite. El análisis se regenera solo a demanda ("Actualizar análisis"),
-- nunca en cada page load. workspace_id = el workspace de la AGENCIA (no
-- hay uno por asesor: el panel analiza a TODOS los setters de la agencia
-- juntos). Solo escribe el Server Action con service-role (no hay policy de
-- insert/update para el cliente de sesión, mismo criterio que kpi_entries).
create table public.kpi_ai_insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_month date not null,
  week_number smallint check (week_number between 1 and 4),
  insights jsonb not null,
  generated_at timestamptz not null default now(),
  unique (workspace_id, period_month, week_number)
);

-- El unique de arriba no alcanza para el análisis MENSUAL (week_number
-- null) — Postgres trata cada NULL como distinto en un unique constraint.
create unique index kpi_ai_insights_monthly_unique
  on public.kpi_ai_insights (workspace_id, period_month)
  where week_number is null;

create index kpi_ai_insights_workspace_idx on public.kpi_ai_insights (workspace_id, period_month, week_number);

alter table public.kpi_ai_insights enable row level security;

create policy "kpi_ai_insights_select" on public.kpi_ai_insights
  for select using (core.is_workspace_member(workspace_id));
