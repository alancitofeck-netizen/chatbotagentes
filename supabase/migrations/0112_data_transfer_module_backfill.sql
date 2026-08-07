-- Habilita "Importar / Exportar" para los workspaces que ya existían antes
-- de esta migración — provision-workspace.ts (0111) solo cubre altas nuevas.
insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'data_transfer', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'data_transfer'
)
on conflict (workspace_id, module_key) do update set enabled = true;
