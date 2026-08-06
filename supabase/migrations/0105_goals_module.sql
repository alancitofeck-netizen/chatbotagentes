-- Módulo "Metas y Bonificaciones": objetivos de venta/producción configurables
-- por el Owner (member_id null = objetivo de todo el equipo, member_id set =
-- individual), y el catálogo de logros/medallas que se desbloquean
-- evaluando reglas determinísticas contra datos reales (nunca un puntaje
-- inventado por IA — mismo criterio de todo el resto de la app).
--
-- Sin tabla de "progreso actual": se calcula en vivo a partir de
-- policies/policy_payments/contacts para el rango de fechas del objetivo
-- (goals/queries.ts), igual que Cobranza reusa getPolicyDashboardKpis en
-- vez de duplicar el cálculo — acá no se puede reusar esas funciones
-- directamente porque tienen ventanas de tiempo fijas ("este mes"/"este
-- año") y un objetivo necesita un rango arbitrario (trimestre, año fiscal,
-- lo que sea que el Owner elija).

create table public.sales_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- null = objetivo de todo el equipo (progreso = agregado de todo el workspace).
  member_id uuid references public.workspace_members (id) on delete cascade,
  created_by uuid references public.workspace_members (id) on delete set null,

  name text not null,
  metric_key text not null check (
    metric_key in ('policies_count', 'premium_issued', 'commission_collected', 'collections_rate', 'new_clients', 'sum_insured')
  ),
  -- "Crear Meta" vs "Crear Bono" (spec del usuario) — un bono además lleva
  -- una descripción de la recompensa (reward_label), una meta no.
  goal_kind text not null default 'meta' check (goal_kind in ('meta', 'bono')),
  reward_label text,

  target_value numeric not null check (target_value > 0),
  period_start date not null,
  period_end date not null check (period_end >= period_start),

  status text not null default 'active' check (status in ('active', 'completed', 'missed', 'archived')),
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_goals_workspace_idx on public.sales_goals (workspace_id, status, period_end);
create index sales_goals_member_idx on public.sales_goals (member_id, status);

create table public.sales_achievements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  unique (workspace_id, member_id, achievement_key)
);

create index sales_achievements_member_idx on public.sales_achievements (member_id, unlocked_at desc);

alter table public.sales_goals enable row level security;
alter table public.sales_achievements enable row level security;

-- Cualquier miembro ve todos los objetivos del workspace (equipo + los de
-- sus compañeros, hace falta para el ranking) — crear/editar/borrar es
-- owner/admin-only, es el pedido explícito de "Configuración para que el
-- Owner pueda crear objetivos personalizados".
create policy sales_goals_select on public.sales_goals
  for select using (core.is_workspace_member(workspace_id));
create policy sales_goals_insert on public.sales_goals
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy sales_goals_update on public.sales_goals
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin']));
create policy sales_goals_delete on public.sales_goals
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Los logros son visibles para todo el workspace (parte del componente
-- social del ranking), pero solo se pueden insertar para uno mismo — el
-- desbloqueo lo dispara el propio usuario al cargar la pantalla
-- (goals/achievements.ts), nunca en nombre de otro miembro.
create policy sales_achievements_select on public.sales_achievements
  for select using (core.is_workspace_member(workspace_id));
create policy sales_achievements_insert on public.sales_achievements
  for insert with check (
    core.is_workspace_member(workspace_id)
    and member_id in (select wm.id from public.workspace_members wm where wm.workspace_id = sales_achievements.workspace_id and wm.user_id = auth.uid())
  );
create policy sales_achievements_delete on public.sales_achievements
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'goals', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'goals'
)
on conflict (workspace_id, module_key) do update set enabled = true;
