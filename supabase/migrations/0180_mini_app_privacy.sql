-- Privacidad por Mini App individual — pedido explícito: las Mini Apps
-- existentes deben seguir siendo públicas para todo el workspace exactamente
-- como hoy (RLS `mini_apps_select` colapsa a la condición actual cuando
-- is_private=false), mientras que una Mini App puntual puede marcarse
-- privada con una whitelist de acceso viewer/editor por miembro.
--
-- Shape de la tabla de accesos calcada de `document_permissions`
-- (0019_documents_module.sql) — misma forma (resource_id, member_id, role
-- viewer/editor, unique juntos), pero a diferencia de Documentos (donde esa
-- tabla es solo metadata informativa, no restringe visibilidad), acá SÍ es
-- la fuente real de autorización vía la RLS reescrita más abajo.

alter table public.mini_apps add column if not exists is_private boolean not null default false;

create table public.mini_app_access (
  id uuid primary key default gen_random_uuid(),
  mini_app_id uuid not null references public.mini_apps (id) on delete cascade,
  member_id uuid not null references public.workspace_members (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  unique (mini_app_id, member_id)
);
create index mini_app_access_mini_app_idx on public.mini_app_access (mini_app_id);

alter table public.mini_app_access enable row level security;

-- Cualquier miembro del workspace puede ver QUIÉN tiene acceso (misma
-- lectura abierta que document_permissions_select) — gestionar (insert/
-- update/delete) es owner/admin únicamente, a diferencia de Documentos
-- (que también permite al "owner" del recurso) porque acá no hay concepto
-- de dueño individual de una Mini App.
create policy "mini_app_access_select" on public.mini_app_access
  for select using (
    exists (select 1 from public.mini_apps a where a.id = mini_app_id and core.is_workspace_member(a.workspace_id))
  );
create policy "mini_app_access_write" on public.mini_app_access
  for all
  using (
    exists (select 1 from public.mini_apps a where a.id = mini_app_id and core.has_workspace_role(a.workspace_id, array['owner', 'admin']))
  )
  with check (
    exists (select 1 from public.mini_apps a where a.id = mini_app_id and core.has_workspace_role(a.workspace_id, array['owner', 'admin']))
  );

-- Reescribe mini_apps_select: para is_private=false (todas las 13 Mini Apps
-- existentes) la condición colapsa exactamente a la policy original —
-- `not is_private` ya es true, así que el resto del OR ni se evalúa.
-- Para is_private=true, además de ser miembro del workspace, hace falta
-- ser owner/admin O tener una fila explícita en mini_app_access.
drop policy if exists "mini_apps_select" on public.mini_apps;
create policy "mini_apps_select" on public.mini_apps
  for select using (
    core.is_workspace_member(workspace_id)
    and (
      not is_private
      or core.has_workspace_role(workspace_id, array['owner', 'admin'])
      or exists (
        select 1 from public.mini_app_access ma
        join public.workspace_members m on m.id = ma.member_id
        where ma.mini_app_id = mini_apps.id and m.user_id = auth.uid()
      )
    )
  );

-- Nueva plantilla "content_calendar" (Cronograma de Contenido) — se suma al
-- catálogo existente de 13 sin reemplazar ninguna (mismo patrón drop/add
-- usado en cada migración de plantilla anterior).
alter table public.mini_apps drop constraint if exists mini_apps_template_key_check;
alter table public.mini_apps add constraint mini_apps_template_key_check
  check (template_key in (
    'simulador_retiro', 'calculadora_brecha_retiro', 'app_vinculada', 'diagnostico_financiero',
    'diagnostico_financiero_retiro', 'diagnostico_solidez_financiera', 'calculadora_capacidad_ingresos',
    'calculadora_meta_universitaria', 'kit_emergencia_financiera_familiar', 'test_preparacion_emergencia_financiera',
    'diagnostico_salud_financiera', 'calculadora_ahorro_fiscal', 'control_financiero_base_cero',
    'content_calendar'
  ));
