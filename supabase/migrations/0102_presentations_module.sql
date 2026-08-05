-- Módulo "Crear mi Presentación": wizard con IA que arma una presentación
-- profesional del asesor (bio, servicios, propuesta de valor) lista para
-- compartir. Mismo patrón exacto que advisory_sessions (0099) — una fila
-- por borrador/presentación, actualizada progresivamente paso a paso
-- (autosave), "columnas fijas + jsonb por paso" en vez de una tabla por
-- paso, porque los campos de cada paso no necesitan filtrarse/ordenarse
-- individualmente.

create table public.presentations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid references public.workspace_members (id) on delete set null,
  created_by uuid references public.workspace_members (id) on delete set null,

  title text not null default 'Nueva presentación',
  client_label text,

  status text not null default 'borrador' check (status in ('borrador', 'generando', 'lista', 'archivada')),
  current_step text not null default 'informacion' check (
    current_step in ('informacion', 'fotos', 'servicios', 'ia', 'vista_previa', 'finalizar')
  ),

  personal_info jsonb not null default '{}',
  -- [{ id, originalPath, selectedPath, enhancedPath, cropMeta }] — enhancedPath
  -- queda null hasta que exista una Fase 2 de IA de fotos real.
  photos jsonb not null default '[]',
  commercial_info jsonb not null default '{}',
  -- Salida cruda de la generación con IA (bio, propuesta de valor, FAQs, etc.)
  ai_content jsonb,
  -- [{ key, title, body, order }] — sembrado desde ai_content pero editable
  -- de forma independiente, para que un ajuste manual en Vista previa nunca
  -- se pierda si se vuelve a generar con IA.
  slides jsonb not null default '[]',

  share_slug text unique,
  share_views_count int not null default 0,
  pdf_storage_path text,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index presentations_workspace_idx on public.presentations (workspace_id, status, updated_at desc);
create index presentations_share_slug_idx on public.presentations (share_slug);

alter table public.presentations enable row level security;

-- Mismo patrón exacto que advisory_sessions/policies: select para cualquier
-- miembro, insert/update para owner/admin/agent, delete solo owner/admin.
create policy presentations_select on public.presentations
  for select using (core.is_workspace_member(workspace_id));
create policy presentations_insert on public.presentations
  for insert with check (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy presentations_update on public.presentations
  for update using (core.has_workspace_role(workspace_id, array['owner', 'admin', 'agent']));
create policy presentations_delete on public.presentations
  for delete using (core.has_workspace_role(workspace_id, array['owner', 'admin']));

-- Registra el module_key y lo habilita para los workspaces existentes —
-- mismo patrón que 0099_advisory_sessions_module.sql.
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies', 'advisory_sessions', 'collections', 'presentations'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'presentations', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'presentations'
)
on conflict (workspace_id, module_key) do update set enabled = true;

-- Bucket para fotos + PDF final de cada presentación — mismo shape que
-- mini-app-bundles (0075): público + policy SELECT propia (el INSERT del
-- Storage API usa RETURNING, falla RLS sin esto aunque el bucket sea
-- público), path {workspace_id}/{presentation_id}/... como primer segmento
-- (evita el bug de shadowing de mini-app-logos, documentado en 0075). Las
-- escrituras reales van todas por service-role (mismo motivo que
-- mini-app-bundles: Storage no valida la clave de firma ES256 de este
-- proyecto) — estas políticas quedan como higiene.
insert into storage.buckets (id, name, public)
values ('presentation-assets', 'presentation-assets', true)
on conflict (id) do nothing;

create policy "presentation_assets_storage_select" on storage.objects
  for select using (bucket_id = 'presentation-assets');

create policy "presentation_assets_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'presentation-assets'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

create policy "presentation_assets_storage_update" on storage.objects
  for update using (
    bucket_id = 'presentation-assets'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

create policy "presentation_assets_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'presentation-assets'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );
