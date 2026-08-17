-- Módulo "Operaciones" — solo owner/admin (el gate de rol vive en
-- src/app/(protected)/operaciones/layout.tsx, no acá). A diferencia de
-- Asesorías, no tiene tabla propia: son 2 herramientas fijas (HTML del
-- usuario servido en iframe mismo-origen), sin instancias que crear ni
-- estado que persistir en Supabase.
alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in (
    'crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies',
    'advisory_sessions', 'collections', 'presentations', 'policy_extraction', 'goals',
    'ai_assistant', 'insurance_providers', 'data_transfer', 'asesorias', 'asesores', 'agenda',
    'operaciones'
  ));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'operaciones', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'operaciones'
)
on conflict (workspace_id, module_key) do update set enabled = true;
