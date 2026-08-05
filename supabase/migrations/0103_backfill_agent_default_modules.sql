-- Cada migración de un módulo nuevo (0089 policies, 0074 insurance_prospects,
-- 0099 advisory_sessions, 0100 collections) ya hizo un backfill de
-- workspace_modules — pero solo para los workspaces que existían en ESE
-- momento. provisionDefaultWorkspaceIfNeeded (src/lib/auth/provision-workspace.ts)
-- nunca incluyó estos module_key en la lista de módulos habilitados al
-- crear un workspace nuevo, así que todo workspace creado DESPUÉS de esas
-- migraciones (y antes de este fix) quedó sin estos módulos — y como todo
-- signup nuevo se crea con rol "agent" (nunca "owner"/"admin"), nadie en
-- ese workspace puede prenderlos desde Perfil > Módulos (requireManagerRole).
-- Repite el mismo backfill una vez más, esta vez incondicional sobre
-- cualquier workspace al que le falten, para destrabar los que quedaron
-- atrapados en ese hueco.

insert into public.workspace_modules (workspace_id, module_key, enabled)
select w.id, m.module_key, true
from public.workspaces w
cross join (values ('policies'), ('insurance_prospects'), ('collections'), ('advisory_sessions')) as m(module_key)
where not exists (
  select 1 from public.workspace_modules wm
  where wm.workspace_id = w.id and wm.module_key = m.module_key
)
on conflict (workspace_id, module_key) do update set enabled = true;
