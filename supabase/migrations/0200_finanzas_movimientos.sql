-- Finanzas (reemplaza Cobranza): tabla propia para cobros genéricos
-- (pólizas/asesorías/ventas) y gastos (herramientas/cursos/otros), nunca
-- atados a policy_payments. "vencido"/"pronto" NUNCA se persisten, se
-- derivan de fecha_vencimiento en cada lectura (mismo criterio que
-- deriveCollectionBucket en collections/constants.ts).

create table public.finanzas_movimientos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  tipo text not null check (tipo in ('in', 'out')),
  categoria text not null,
  descripcion text not null,
  contraparte text,
  monto numeric not null check (monto > 0),
  moneda text not null default 'USD',
  fecha_vencimiento date not null,
  medio_pago text,
  detalle_medio text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado')),
  fecha_pago date,
  recurrencia text not null default 'ninguna' check (recurrencia in ('ninguna', 'mensual', 'anual')),
  notas text,
  created_by uuid references public.workspace_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finanzas_movimientos_categoria_check check (
    (tipo = 'in'  and categoria in ('poliza', 'asesoria', 'venta')) or
    (tipo = 'out' and categoria in ('herramienta', 'curso', 'gasto'))
  )
);

create index finanzas_movimientos_workspace_due_idx on public.finanzas_movimientos (workspace_id, fecha_vencimiento);
create index finanzas_movimientos_workspace_estado_idx on public.finanzas_movimientos (workspace_id, estado);

alter table public.finanzas_movimientos enable row level security;

create policy finanzas_movimientos_select on public.finanzas_movimientos
  for select using (core.is_workspace_member(workspace_id));
create policy finanzas_movimientos_insert on public.finanzas_movimientos
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy finanzas_movimientos_update on public.finanzas_movimientos
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy finanzas_movimientos_delete on public.finanzas_movimientos
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Limpieza: el motor de automatizaciones de Cobranza (0100) queda sin uso
-- una vez borrados src/lib/collections/automationRules.ts, aiAnalysis.ts y
-- el cron api/cron/collection-automations (código borrado en este mismo
-- cambio) — nada más referencia estas tablas.
drop table if exists public.collection_automation_log;
drop table if exists public.collection_automation_rules;
