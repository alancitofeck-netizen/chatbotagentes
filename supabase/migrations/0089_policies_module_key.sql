-- Registra "policies" como module_key válido y lo habilita para los
-- workspaces existentes — mismo patrón exacto que 0074_insurance_prospects.sql
-- (constraint + backfill "enabled by default" para no dejar una fila
-- workspace_modules faltante, que la app ya trata como "deshabilitado").

alter table public.workspace_modules drop constraint if exists workspace_modules_module_key_check;
alter table public.workspace_modules add constraint workspace_modules_module_key_check
  check (module_key in ('crm', 'ats', 'advisors', 'mini_apps', 'tasks', 'insurance_prospects', 'policies'));

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'policies', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'policies'
)
on conflict (workspace_id, module_key) do update set enabled = true;
