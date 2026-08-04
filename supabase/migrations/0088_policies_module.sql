-- Sistema de Gestión de Pólizas — Fase 1. Distinto de insurance_prospects
-- (0074_insurance_prospects.sql, un rastreador de LEADS pre-venta que
-- termina en 'poliza_emitida'): esta tabla gestiona la póliza ya activa
-- (prima, comisión, coberturas, vencimiento), su propio ciclo de vida
-- post-venta. Mismo patrón RLS que opportunities (owner/admin/agent para
-- insert/update, owner/admin para delete, cualquier miembro para select) y
-- misma integración con el motor de pipeline genérico ya usado por
-- CRM/Asesores (pipeline_items/pipeline_stages) — sin tabla de "etapas"
-- propia, se reutiliza la existente.

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  pipeline_item_id uuid references public.pipeline_items (id) on delete set null,
  owner_id uuid references public.workspace_members (id) on delete set null,
  created_by uuid references public.workspace_members (id) on delete set null,

  policy_number text,
  company text not null,
  product text,
  insurance_type text not null default 'otro' check (insurance_type in ('auto', 'hogar', 'vida', 'otro')),
  -- Espejo de la etapa del pipeline (mismo criterio que opportunities.status
  -- sincronizado en moveOpportunityCard) — permite filtrar/agrupar sin tener
  -- que joinear pipeline_stages en cada query de KPIs/dashboard.
  status text not null default 'cotizacion' check (
    status in (
      'cotizacion', 'documentacion', 'pendiente_emision', 'emitida', 'activa',
      'renovacion_proxima', 'renovacion_enviada', 'renovada', 'vencida', 'cancelada'
    )
  ),

  issue_date date,
  start_date date,
  end_date date,

  premium numeric,
  premium_currency text not null default 'USD',
  payment_frequency text check (payment_frequency in ('mensual', 'trimestral', 'semestral', 'anual', 'unico')),

  commission_amount numeric,
  commission_status text check (commission_status in ('esperada', 'cobrada', 'pendiente')),

  sum_insured numeric,
  deductible text,

  -- Beneficiarios: campo general (el usuario lo pidió tanto a nivel general
  -- como específico de "vida") — [{ name, relationship, percentage }].
  beneficiaries jsonb not null default '[]',
  -- Campos específicos por tipo de seguro (auto: make/model/year/plate/vin/
  -- engine; hogar: address/m2/type) — jsonb en vez de columnas nullable por
  -- tipo, mismo patrón ya usado en contacts.custom_fields para datos
  -- variables/extensibles sin migración nueva por cada tipo de seguro futuro.
  type_details jsonb not null default '{}',

  notes text,
  source text not null default 'manual' check (source in ('manual', 'pdf_ai')),
  -- La póliza original en PDF vive en el módulo de Documentos genérico
  -- (documents.related_type/related_id, ya preparado para esto) — esta
  -- columna es solo un acceso directo al documento "principal".
  pdf_document_id uuid references public.documents (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index policies_workspace_idx on public.policies (workspace_id);
create index policies_contact_idx on public.policies (contact_id);
create index policies_end_date_idx on public.policies (workspace_id, end_date);
create index policies_status_idx on public.policies (workspace_id, status);

alter table public.policies enable row level security;

create policy "policies_select" on public.policies
  for select using (core.is_workspace_member(workspace_id));
create policy "policies_insert" on public.policies
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "policies_update" on public.policies
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']))
  with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy "policies_delete" on public.policies
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Coberturas — lista real, editable individualmente (agregar/editar/borrar),
-- por eso es su propia tabla y no otro campo jsonb.
create table public.policy_coverages (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete cascade,
  name text not null,
  sum_insured numeric,
  deductible text,
  limit_text text,
  exclusions text,
  created_at timestamptz not null default now()
);

create index policy_coverages_policy_idx on public.policy_coverages (policy_id);

alter table public.policy_coverages enable row level security;

create policy "policy_coverages_select" on public.policy_coverages
  for select using (
    exists (select 1 from public.policies p where p.id = policy_id and core.is_workspace_member(p.workspace_id))
  );
create policy "policy_coverages_insert" on public.policy_coverages
  for insert with check (
    exists (
      select 1 from public.policies p
      where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent'])
    )
  );
create policy "policy_coverages_update" on public.policy_coverages
  for update using (
    exists (
      select 1 from public.policies p
      where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent'])
    )
  );
create policy "policy_coverages_delete" on public.policy_coverages
  for delete using (
    exists (
      select 1 from public.policies p
      where p.id = policy_id and core.has_workspace_role(p.workspace_id, array['owner', 'admin', 'agent'])
    )
  );
