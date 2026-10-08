-- Activa el módulo ManyChat en los workspaces de los asesores (los que tienen
-- algún miembro con rol "agent"). El módulo nació con defaultEnabled=false
-- (src/lib/modules/catalog.ts) y un asesor no puede prenderlo solo desde
-- Perfil > Módulos (toggleModule exige requireManagerRole), así que sin este
-- backfill nunca les aparecía. Los workspaces nuevos ya lo reciben activo
-- desde el catálogo (defaultEnabled pasa a true).

insert into public.workspace_modules (workspace_id, module_key, enabled)
select distinct m.workspace_id, 'manychat', true
from public.workspace_members m
where m.role = 'agent'
on conflict (workspace_id, module_key) do update set enabled = true;
