-- Mini Apps pasa a activarse por defecto para todo workspace, igual que CRM
-- y Asesores en provision-workspace.ts — evita que un workspace solo-agente
-- (todo self-signup crea al usuario con rol 'agent', nunca 'owner') quede
-- permanentemente sin poder activarlo, ya que activar un módulo requiere
-- rol owner/admin (requireManagerRole, src/lib/settings/actions.ts) y ese
-- workspace no tiene ningún miembro con ese rol.
insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, 'mini_apps', true
from public.workspaces w
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = 'mini_apps'
)
on conflict (workspace_id, module_key) do update set enabled = true;
