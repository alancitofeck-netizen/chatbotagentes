-- "Vincular App" Fase 2: bucket público para alojar el HTML/ZIP que el
-- usuario sube (en vez de depender de una URL externa). Mismo shape que
-- mini-app-logos (0062) — bucket público + política SELECT propia (el
-- gotcha ya documentado ahí: el INSERT del Storage API usa RETURNING, que
-- falla RLS sin una policy SELECT que matchee aunque el bucket sea público).
--
-- Path convention DELIBERADAMENTE distinta a mini-app-logos:
-- {workspace_id}/{mini_app_id}/{ruta-relativa-dentro-del-bundle} en vez de
-- {mini_app_id}/... — mini-app-logos (y su policy con JOIN a mini_apps) tiene
-- un bug de shadowing ya documentado y dejado sin arreglar en
-- 0068_fix_storage_foldername_name_shadowing.sql (storage.objects.name queda
-- shadowed por mini_apps.name dentro del EXISTS, así que el chequeo de rol
-- nunca matchea). Acá se usa directamente el patrón ya probado que SÍ
-- funciona (documents/task-group-covers): workspace_id como primer segmento
-- del path, sin join a otra tabla. En la práctica las escrituras reales van
-- todas por service-role (bundle-upload/route.ts), que bypasea RLS — estas
-- políticas quedan como higiene/para el día que una subida directa del
-- navegador vuelva a ser viable (ver comentario en actions.ts sobre la clave
-- de firma JWT de Storage).

insert into storage.buckets (id, name, public)
values ('mini-app-bundles', 'mini-app-bundles', true)
on conflict (id) do nothing;

create policy "mini_app_bundles_storage_select" on storage.objects
  for select using (bucket_id = 'mini-app-bundles');

create policy "mini_app_bundles_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'mini-app-bundles'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

create policy "mini_app_bundles_storage_update" on storage.objects
  for update using (
    bucket_id = 'mini-app-bundles'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );

create policy "mini_app_bundles_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'mini-app-bundles'
    and core.has_workspace_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'agent'])
  );
